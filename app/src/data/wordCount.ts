/**
 * Deterministic text maths shared by the word counter, the copy detector and the grader.
 *
 * `countWords` is deliberately a whitespace split so it matches the `wordCount`
 * values stored in the bank (verified for all 174 reference answers at boot).
 */

import {
  BANNED_PHRASE_RULES,
  COPY_RUN_MIN_WORDS,
  type BannedPhraseRule,
} from "../constants";
import type { SliceData } from "../types/bank";

/* ------------------------------------------------------------------ */
/* Word counting                                                       */
/* ------------------------------------------------------------------ */

/** Bank-compatible word count: whitespace-delimited tokens, trimmed. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export interface WordToken {
  /** Lower-cased, punctuation-stripped comparison form. */
  word: string;
  /** Original token as it appeared in the text. */
  raw: string;
  start: number;
  end: number;
}

const TOKEN_PATTERN = /\S+/g;

/** Whitespace tokens with offsets, used for copied-run detection. */
export function tokenizeWords(text: string): WordToken[] {
  const tokens: WordToken[] = [];
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const raw = match[0];
    const start = match.index ?? 0;
    tokens.push({ word: cleanToken(raw), raw, start, end: start + raw.length });
  }
  return tokens;
}

function cleanToken(raw: string): string {
  const cleaned = raw.toLowerCase().replace(/[^a-z0-9']/g, "");
  return cleaned || raw.toLowerCase();
}

/* ------------------------------------------------------------------ */
/* Copied prompt runs                                                  */
/* ------------------------------------------------------------------ */

export interface CopiedRun {
  /** Offset into the answer text. */
  start: number;
  /** Exclusive end offset into the answer text. */
  end: number;
  words: number;
  text: string;
}

/**
 * Finds contiguous runs of `minRun`+ words copied from the prompt.
 * Runs are matched on cleaned tokens so punctuation/case do not hide a copy.
 */
export function findCopiedRuns(
  text: string,
  promptText: string,
  minRun: number = COPY_RUN_MIN_WORDS,
): CopiedRun[] {
  if (!text || !promptText || minRun < 1) return [];
  const answer = tokenizeWords(text);
  const prompt = tokenizeWords(promptText);
  if (answer.length === 0 || prompt.length === 0) return [];

  const promptIndex = new Map<string, number[]>();
  prompt.forEach((token, i) => {
    const positions = promptIndex.get(token.word);
    if (positions) positions.push(i);
    else promptIndex.set(token.word, [i]);
  });

  const runs: CopiedRun[] = [];
  let i = 0;
  while (i < answer.length) {
    let bestLength = 0;
    for (const j of promptIndex.get(answer[i].word) ?? []) {
      let length = 0;
      while (
        i + length < answer.length &&
        j + length < prompt.length &&
        answer[i + length].word === prompt[j + length].word
      ) {
        length += 1;
      }
      if (length > bestLength) bestLength = length;
    }
    if (bestLength >= minRun) {
      const start = answer[i].start;
      const end = answer[i + bestLength - 1].end;
      runs.push({ start, end, words: bestLength, text: text.slice(start, end) });
      i += bestLength;
    } else {
      i += 1;
    }
  }
  return runs;
}

export function countCopiedWords(runs: readonly CopiedRun[]): number {
  return runs.reduce((total, run) => total + run.words, 0);
}

/**
 * Word count with question text excluded (IELTS counting rules).
 * Returns the net count; use `findCopiedRuns` when the spans are needed.
 */
export function countNetWords(
  text: string,
  promptText: string,
  minRun: number = COPY_RUN_MIN_WORDS,
): number {
  const runs = findCopiedRuns(text, promptText, minRun);
  return Math.max(0, countWords(text) - countCopiedWords(runs));
}

/* ------------------------------------------------------------------ */
/* Banned phrases                                                      */
/* ------------------------------------------------------------------ */

export interface BannedPhraseHit {
  /** 1-based index into the bank's 12-entry banned list. */
  ruleIndex: number;
  /** Canonical manifest entry. */
  phrase: string;
  /** The slash-expanded alternative that matched. */
  alternative: string;
  /** Exact text matched in the input (original casing). */
  match: string;
  start: number;
  end: number;
  /** Advisory hits never cap a band (entry 12: idioms, quotes, proverbs). */
  advisory: boolean;
}

interface NormalizedText {
  text: string;
  /** normalized char index -> original char index */
  map: number[];
}

/**
 * Lower-cases, collapses punctuation to single spaces and maps every normalized
 * character back to its original offset so evidence spans stay accurate.
 */
export function normalizeForMatch(input: string): NormalizedText {
  let text = "";
  const map: number[] = [];
  let pendingSpace = false;
  for (let i = 0; i < input.length; i += 1) {
    const raw = input[i];
    const lower = raw.toLowerCase();
    if (/[a-z0-9]/.test(lower)) {
      if (pendingSpace && text.length > 0) {
        text += " ";
        map.push(i);
      }
      pendingSpace = false;
      text += lower;
      map.push(i);
    } else if (raw === "'" || raw === "\u2019" || raw === "\u2018" || raw === "\u02bc") {
      if (!pendingSpace && /[a-z0-9]$/.test(text)) {
        text += "'";
        map.push(i);
      }
    } else {
      pendingSpace = text.length > 0;
    }
  }
  return { text, map };
}

/**
 * Finds banned/memorised phrases. Entries 4, 7 and 9 hold slash-separated options and
 * are expanded first; entry 12 is advisory only and reported separately.
 */
export function checkBannedPhrases(
  text: string,
  rules: readonly BannedPhraseRule[] = BANNED_PHRASE_RULES,
): BannedPhraseHit[] {
  const hits: BannedPhraseHit[] = [];
  if (!text || !text.trim()) return hits;

  const normalized = normalizeForMatch(text);
  const seen = new Set<string>();

  const push = (hit: BannedPhraseHit) => {
    const key = `${hit.ruleIndex}:${hit.start}:${hit.end}`;
    if (seen.has(key)) return;
    seen.add(key);
    hits.push(hit);
  };

  for (const rule of rules) {
    for (const alternative of rule.alternatives) {
      const needle = normalizeForMatch(alternative).text;
      if (!needle) continue;
      let from = 0;
      for (;;) {
        const at = normalized.text.indexOf(needle, from);
        if (at === -1) break;
        const start = normalized.map[at] ?? 0;
        const end = (normalized.map[at + needle.length - 1] ?? start) + 1;
        push({
          ruleIndex: rule.index,
          phrase: rule.phrase,
          alternative,
          match: text.slice(start, end),
          start,
          end,
          advisory: rule.advisory,
        });
        from = at + needle.length;
      }
    }

    for (const pattern of rule.patterns ?? []) {
      pattern.lastIndex = 0;
      for (const match of text.matchAll(pattern)) {
        if (match.index === undefined) continue;
        const start = match.index;
        const end = start + match[0].length;
        push({
          ruleIndex: rule.index,
          phrase: rule.phrase,
          alternative: match[0],
          match: match[0],
          start,
          end,
          advisory: rule.advisory,
        });
      }
    }
  }

  return hits.sort((a, b) => a.start - b.start || a.ruleIndex - b.ruleIndex);
}

/* ------------------------------------------------------------------ */
/* Pie validation                                                      */
/* ------------------------------------------------------------------ */

export interface PieSumGroup {
  year: number | string | null;
  sum: number;
}

export interface PieSumResult {
  ok: boolean;
  /** Expected total per pie (`item.whole`, defaults to 100). */
  whole: number;
  groups: PieSumGroup[];
  maxDeviation: number;
}

/**
 * Sums `slices.percent` per year and checks each pie against `whole`.
 * Used by the boot validator; renderers can reuse it for sanity checks.
 */
export function pieSums(item: { slices?: SliceData[] | null; whole?: number | null }): PieSumResult {
  const whole = typeof item.whole === "number" ? item.whole : 100;
  const byYear = new Map<string, PieSumGroup>();

  for (const slice of item.slices ?? []) {
    if (!slice) continue;
    const year = slice.year ?? null;
    const key = year === null ? "__unknown__" : String(year);
    const bucket = byYear.get(key) ?? { year, sum: 0 };
    bucket.sum += typeof slice.percent === "number" ? slice.percent : 0;
    byYear.set(key, bucket);
  }

  const groups = Array.from(byYear.values()).map((group) => ({
    year: group.year,
    sum: Math.round(group.sum * 1000) / 1000,
  }));
  const maxDeviation = groups.reduce((max, group) => Math.max(max, Math.abs(group.sum - whole)), 0);

  return {
    ok: groups.length > 0 && maxDeviation < 0.001,
    whole,
    groups,
    maxDeviation: Math.round(maxDeviation * 1000) / 1000,
  };
}

/* ------------------------------------------------------------------ */
/* Word-count classification (WordCounter styling + grader reuse)       */
/* ------------------------------------------------------------------ */

export type WordCountLevel = "under" | "target" | "over" | "over-ceiling";

export interface WordCountInput {
  min: number;
  target: [number, number];
  ceiling: number;
  /** Optional "writing too much" warning line (Task 1 uses 200, Task 2 uses the ceiling). */
  warn?: number;
}

export interface WordCountStatus {
  count: number;
  level: WordCountLevel;
  message: string;
  /** True once the count passes the optional warning line but is still under the ceiling. */
  overWarn: boolean;
}

/**
 * Visual contract: amber below `min`, green inside `target`, neutral between the
 * target and the ceiling, red above the ceiling.
 */
export function classifyWordCount(count: number, input: WordCountInput): WordCountStatus {
  const [targetMin, targetMax] = input.target;
  const warn = input.warn ?? input.ceiling;
  const overWarn = count > warn && count <= input.ceiling;

  if (count < input.min) {
    const short = input.min - count;
    return {
      count,
      level: "under",
      overWarn: false,
      message: `${count} words — ${short} below the ${input.min}-word minimum.`,
    };
  }
  if (count <= targetMax) {
    return {
      count,
      level: "target",
      overWarn: false,
      message: `${count} words — within the ${targetMin}–${targetMax} target band.`,
    };
  }
  if (count > input.ceiling) {
    return {
      count,
      level: "over-ceiling",
      overWarn: false,
      message: `${count} words — over the ${input.ceiling}-word ceiling; trim rather than add detail.`,
    };
  }
  return {
    count,
    level: "over",
    overWarn,
    message: overWarn
      ? `${count} words — past the ${warn}-word warning line and close to the ${input.ceiling} ceiling.`
      : `${count} words — above the ${targetMax} target but still under the ${input.ceiling} ceiling.`,
  };
}

/* ------------------------------------------------------------------ */
/* Offline spelling dictionary                                         */
/* ------------------------------------------------------------------ */

/* 10138 most frequent English words (Google Trillion Word Corpus frequency list, swear-free cut) + the most frequent spoken-English words. */
const COMMON_ENGLISH_WORDS = [
  "the of and to in for is on that by this with you it not or be are from at as your all have new more an was we will home can us about if page my has search free but our one other do no information time they site he up may what which their news out use any there see only so his when contact here business who web also now help get pm view online first am been would how were me services some these click its like service than find price date back top people had list name just over state year day into email two health world re next used go work last most products music buy data make them should product system post her city add policy number such please available copyright support message after best software then jan good video well where info rights public books high school through each links she review years order very privacy book items company read group need many user said de does set under general research university january mail full map reviews program life know games way days",
  "management part could great united hotel real item international center ebay must store travel comments made development report off member details line terms before hotels did send right type because local those using results office education national car design take posted internet address community within states area want phone dvd shipping reserved subject between forum family long based code show even black check special prices website index being women much sign file link open today technology south case project same pages uk version section own found sports house related security both county american photo game members power while care network down computer systems three total place end following download him without per access think north resources current posts big media law control water history pictures size art personal since including guide shop directory board location change white text small rating rate government children during usa return students shopping account times",
  "sites level digital profile previous form events love old john main call hours image department title description non insurance another why shall property class cd still money quality every listing content country private little visit save tools low reply customer december compare movies include college value article york man card jobs provide food source author different press learn sale around print course job canada process teen room stock training too credit point join science men categories advanced west sales look english left team estate box conditions select windows photos gay thread week category note live large gallery table register however june october november market library really action start series model features air industry plan human provided tv yes required second hot accessories cost movie forums march la september better say questions july yahoo going medical test friend come dec server pc study application cart staff articles san feedback again play looking",
  "issues april never users complete street topic comment financial things working against standard tax person below mobile less got blog party payment equipment login student let programs offers legal above recent park stores side act problem red give memory performance social august quote language story sell options experience rates create key body young america important field few east paper single ii age activities club example girls additional password latest something road gift question changes night ca hard texas oct pay four poker status browse issue range building seller court february always result audio light write war nov offer blue groups al easy given files event release analysis request fax china making picture needs possible might professional yet month major star areas future space committee hand sun cards problems london washington meeting rss become interest id child keep enter california share similar garden schools million added reference companies listed baby",
  "learning energy run delivery net popular term film stories put computers journal reports co try welcome central images president notice original head radio until cell color self council away includes track australia discussion archive once others entertainment agreement format least society months log safety friends sure faq trade edition cars messages marketing tell further updated association able having provides david fun already green studies close common drive specific several gold feb living sep collection called short arts lot ask display limited powered solutions means director daily beach past natural whether due et electronics five upon period planning database says official weather mar land average done technical window france pro region island record direct microsoft conference environment records st district calendar costs style url front statement update parts aug ever downloads early miles sound resource present applications either ago document word works material bill",
  "apr written talk federal hosting rules final adult tickets thing centre requirements via cheap kids finance true minutes else mark third rock gifts europe reading topics bad individual tips plus auto cover usually edit together videos percent fast function fact unit getting global tech meet far economic en player projects lyrics often subscribe submit germany amount watch included feel though bank risk thanks everything deals various words linux jul production commercial james weight town heart advertising received choose treatment newsletter archives points knowledge magazine error camera jun girl currently construction toys registered clear golf receive domain methods chapter makes protection policies loan wide beauty manager india position taken sort listings models michael known half cases step engineering florida simple quick none wireless license paul friday lake whole annual published later basic sony shows corporate google church method purchase customers active response",
  "practice hardware figure materials fire holiday chat enough designed along among death writing speed html countries loss face brand discount higher effects created remember standards oil bit yellow political increase advertise kingdom base near environmental thought stuff french storage oh japan doing loans shoes entry stay nature orders availability africa summary turn mean growth notes agency king monday european activity copy although drug pics western income force cash employment overall bay river commission ad package contents seen players engine port album regional stop supplies started administration bar institute views plans double dog build screen exchange types soon sponsored lines electronic continue across benefits needed season apply someone held ny anything printer condition effective believe organization effect asked eur mind sunday selection casino pdf lost tour menu volume cross anyone mortgage hope silver corporation wish inside solution mature role rather weeks",
  "addition came supply nothing certain usr executive running lower necessary union jewelry according dc clothing mon com particular fine names robert homepage hour gas skills six bush islands advice career military rental decision leave british teens pre huge sat woman facilities zip bid kind sellers middle move cable opportunities taking values division coming tuesday object lesbian appropriate machine logo length actually nice score statistics client ok returns capital follow sample investment sent shown saturday christmas england culture band flash ms lead george choice went starting registration fri thursday courses consumer hi airport foreign artist outside furniture levels channel letter mode phones ideas wednesday structure fund summer allow degree contract button releases wed homes super male matter custom virginia almost took located multiple asian distribution editor inn industrial cause potential song cnet ltd los hp focus late fall featured idea rooms female responsible inc",
  "communications win associated thomas primary cancer numbers reason tool browser spring foundation answer voice eg friendly schedule documents communication purpose feature bed comes police everyone independent ip approach cameras brown physical operating hill maps medicine deal hold ratings chicago forms glass happy tue smith wanted developed thank safe unique survey prior telephone sport ready feed animal sources mexico population pa regular secure navigation operations therefore simply evidence station christian round paypal favorite understand option master valley recently probably thu rentals sea built publications blood cut worldwide improve connection publisher hall larger anti networks earth parents nokia impact transfer introduction kitchen strong tel carolina wedding properties hospital ground overview ship accommodation owners disease tx excellent paid italy perfect hair opportunity kit classic basis command cities william express award distance tree peter assessment ensure",
  "thus wall ie involved el extra especially interface partners budget rated guides success maximum ma operation existing quite selected boy amazon patients restaurants beautiful warning wine locations horse vote forward flowers stars significant lists technologies owner retail animals useful directly manufacturer ways est son providing rule mac housing takes iii gmt bring catalog searches max trying mother authority considered told xml traffic programme joined input strategy feet agent valid bin modern senior ireland teaching door grand testing trial charge units instead canadian cool normal wrote enterprise ships entire educational md leading metal positive fl fitness chinese opinion mb asia football abstract uses output funds mr greater likely develop employees artists alternative processing responsibility resolution java guest seems publication pass relations trust van contains session multi photography republic fees components vacation century academic assistance completed skin",
  "graphics indian prev ads mary il expected ring grade dating pacific mountain organizations pop filter mailing vehicle longer consider int northern behind panel floor german buying match proposed default require iraq boys outdoor deep morning otherwise allows rest protein plant reported hit transportation mm pool mini politics partner disclaimer authors boards faculty parties fish membership mission eye string sense modified pack released stage internal goods recommended born unless richard detailed japanese race approved background target except character usb maintenance ability maybe functions ed moving brands places php pretty trademarks phentermine spain southern yourself etc winter battery youth pressure submitted boston debt keywords medium television interested core break purposes throughout sets dance wood msn itself defined papers playing awards fee studio reader virtual device established answers rent las remote dark programming external apple le regarding instructions min",
  "offered theory enjoy remove aid surface minimum visual host variety teachers isbn martin manual block subjects agents increased repair fair civil steel understanding songs fixed wrong beginning hands associates finally az updates desktop classes paris ohio gets sector capacity requires jersey un fat fully father electric saw instruments quotes officer driver businesses dead respect unknown specified restaurant mike trip pst worth mi procedures poor teacher eyes relationship workers farm georgia peace traditional campus tom showing creative coast benefit progress funding devices lord grant sub agree fiction hear sometimes watches careers beyond goes families led museum themselves fan transport interesting blogs wife evaluation accepted former implementation ten hits zone complex th cat galleries references die presented jack flat flow agencies literature respective parent spanish michigan columbia setting dr scale stand economy highest helpful monthly critical frame musical definition",
  "secretary angeles networking path australian employee chief gives kb bottom magazines packages detail francisco laws changed pet heard begin individuals colorado royal clean switch russian largest african guy titles relevant guidelines justice connect bible dev cup basket applied weekly vol installation described demand pp suite vegas na square chris attention advance skip diet army auction gear lee os difference allowed correct charles nation selling lots piece sheet firm seven older illinois regulations elements species jump cells module resort facility random pricing dvds certificate minister motion looks fashion directions visitors documentation monitor trading forest calls whose coverage couple giving chance vision ball ending clients actions listen discuss accept automotive naked goal successful sold wind communities clinical situation sciences markets lowest highly publishing appear emergency developing lives currency leather determine temperature palm announcements patient",
  "actual historical stone bob commerce ringtones perhaps persons difficult scientific satellite fit tests village accounts amateur ex met pain xbox particularly factors coffee www settings buyer cultural steve easily oral ford poster edge functional root au fi closed holidays ice pink zealand balance monitoring graduate replies shot nc architecture initial label thinking scott llc sec recommend canon league waste minute bus provider optional dictionary cold accounting manufacturing sections chair fishing effort phase fields bag fantasy po letters motor va professor context install shirt apparel generally continued foot mass crime count breast techniques ibm rd johnson sc quickly dollars websites religion claim driving permission surgery patch heat wild measures generation kansas miss chemical doctor task reduce brought himself nor component enable exercise bug santa mid guarantee leader diamond israel se processes soft servers alone meetings seconds jones arizona keyword interests flight",
  "congress fuel username walk produced italian paperback classifieds wait supported pocket saint rose freedom argument competition creating jim drugs joint premium providers fresh characters attorney upgrade di factor growing thousands km stream apartments pick hearing eastern auctions therapy entries dates generated signed upper administrative serious prime samsung limit began louis steps errors shops del efforts informed ga ac thoughts creek ft worked quantity urban practices sorted reporting essential myself tours platform load affiliate labor immediately admin nursing defense machines designated tags heavy covered recovery joe guys integrated configuration merchant comprehensive expert universal protect drop solid cds presentation languages became orange compliance vehicles prevent theme rich im campaign marine improvement vs guitar finding pennsylvania examples ipod saying spirit ar claims challenge motorola acceptance strategies mo seem affairs touch intended towards sa goals hire",
  "election suggest branch charges serve affiliates reasons magic mount smart talking gave ones latin multimedia xp avoid certified manage corner rank computing oregon element birth virus abuse interactive requests separate quarter procedure leadership tables define racing religious facts breakfast kong column plants faith chain developer identify avenue missing died approximately domestic sitemap recommendations moved houston reach comparison mental viewed moment extended sequence inch attack sorry centers opening damage lab reserve recipes cvs gamma plastic produce snow placed truth counter failure follows eu weekend dollar camp ontario automatically des minnesota films bridge native fill williams movement printing baseball owned approval draft chart played contacts cc jesus readers clubs lcd wa jackson equal adventure matching offering shirts profit leaders posters institutions assistant variable ave dj advertisement expect parking headlines yesterday compared determined wholesale",
  "workshop russia gone codes kinds extension seattle statements golden completely teams fort cm wi lighting senate forces funny brother gene turned portable tried electrical applicable disc returned pattern ct boat named theatre laser earlier manufacturers sponsor classical icon warranty dedicated indiana direction harry basketball objects ends delete evening assembly nuclear taxes mouse signal criminal issued brain sexual wisconsin powerful dream obtained false da cast flower felt personnel passed supplied identified falls pic soul aids opinions promote stated stats hawaii professionals appears carry flag decided nj covers hr em advantage hello designs maintain tourism priority newsletters adults clips savings iv graphic atom payments rw estimated binding brief ended winning eight anonymous iron straight script served wants miscellaneous prepared void dining alert integration atlanta dakota tag interview mix framework disk installed queen vhs credits clearly fix handle sweet desk",
  "criteria pubmed dave massachusetts diego hong vice associate ne truck behavior enlarge ray frequently revenue measure changing votes du duty looked discussions bear gain festival laboratory ocean flights experts signs lack depth iowa whatever logged laptop vintage train exactly dry explore maryland spa concept nearly eligible checkout reality forgot handling origin knew gaming feeds billion destination scotland faster intelligence dallas bought con ups nations route followed specifications broken tripadvisor frank alaska zoom blow battle residential anime speak decisions industries protocol query clip partnership editorial nt expression es equity provisions speech wire principles suggestions rural shared sounds replacement tape strategic judge spam economics acid bytes cent forced compatible fight apartment height null zero speaker filed gb netherlands obtain bc consulting recreation offices designer remain managed pr failed marriage roll korea banks fr participants secret bath aa",
  "kelly leads negative austin favorites toronto theater springs missouri andrew var perform healthy translation estimates font assets injury mt joseph ministry drivers lawyer figures married protected proposal sharing philadelphia portal waiting birthday beta fail gratis banking officials brian toward won slightly assist conduct contained lingerie legislation calling parameters jazz serving bags profiles miami comics matters houses doc postal relationships tennessee wear controls breaking combined ultimate wales representative frequency introduced minor finish departments residents noted displayed mom reduced physics rare spent performed extreme samples davis daniel bars reviewed row oz forecast removed helps singles administrator cycle amounts contain accuracy dual rise usd sleep mg bird pharmacy brazil creation static scene hunter addresses lady crystal famous writer chairman violence fans oklahoma speakers drink academy dynamic gender eat permanent agriculture dell cleaning",
  "constitutes portfolio practical delivered collectibles infrastructure exclusive seat concerns colour vendor originally intel utilities philosophy regulation officers reduction aim bids referred supports nutrition recording regions junior toll les cape ann rings meaning tip secondary wonderful mine ladies henry ticket announced guess agreed prevention whom ski soccer math import posting presence instant mentioned automatic healthcare viewing maintained ch increasing majority connected christ dan dogs sd directors aspects austria ahead moon participation scheme utility preview fly manner matrix containing combination devel amendment despite strength guaranteed turkey libraries proper distributed degrees singapore enterprises delta fear seeking inches phoenix rs convention shares principal daughter standing comfort colors wars cisco ordering kept alpha appeal cruise bonus certification previously hey bookmark buildings specials beat disney household batteries adobe smoking bbc becomes",
  "drives arms alabama tea improved trees avg achieve positions dress subscription dealer contemporary sky utah nearby rom carried happen exposure panasonic hide permalink signature gambling refer miller provision outdoors clothes caused luxury babes frames certainly indeed newspaper toy circuit layer printed slow removal easier src liability trademark hip printers faqs nine adding kentucky mostly eric spot taylor trackback prints spend factory interior revised grow americans optical promotion relative amazing clock dot hiv identity suites conversion feeling hidden reasonable victoria serial relief revision broadband influence ratio pda importance rain onto dsl planet webmaster copies recipe zum permit seeing proof dna diff tennis bass prescription bedroom empty instance hole pets ride licensed orlando specifically tim bureau maine sql represent conservation pair ideal specs recorded don pieces finished parks dinner lawyers sydney stress cream ss runs trends yeah discover ap patterns",
  "boxes louisiana hills javascript fourth nm advisor mn marketplace nd evil aware wilson shape evolution irish certificates objectives stations suggested gps op remains acc greatest firms concerned euro operator structures generic encyclopedia usage cap ink charts continuing mixed census interracial peak tn competitive exist wheel transit suppliers salt compact poetry lights tracking angel bell keeping preparation attempt receiving matches accordance width noise engines forget array discussed accurate stephen elizabeth climate reservations pin playstation alcohol greek instruction managing annotation sister raw differences walking explain smaller newest establish gnu happened expressed jeff extent sharp lesbians ben lane paragraph kill mathematics aol compensation ce export managers aircraft modules sweden conflict conducted versions employer occur percentage knows mississippi describe concern backup requested citizens connecticut heritage personals immediate holding trouble spread coach",
  "kevin agricultural expand supporting audience assigned jordan collections ages participate plug specialist cook affect virgin experienced investigation raised hat institution directed dealers searching sporting helping perl affected lib bike totally plate expenses indicate blonde ab proceedings favourite transmission anderson utc characteristics der lose organic seek experiences albums cheats extremely verzeichnis contracts guests hosted diseases concerning developers equivalent chemistry tony neighborhood nevada kits thailand variables agenda anyway continues tracks advisory cam curriculum logic template prince circle soil grants anywhere psychology responses atlantic wet circumstances edward investor identification ram leaving wildlife appliances matt elementary cooking speaking sponsors fox unlimited respond sizes plain exit entered iran arm keys launch wave checking costa belgium printable holy acts guidance mesh trail enforcement symbol crafts highway buddy hardcover observed dean",
  "setup poll booking glossary fiscal celebrity styles denver unix filled bond channels ericsson appendix notify blues chocolate pub portion scope hampshire supplier cables cotton bluetooth controlled requirement authorities biology dental killed border ancient debate representatives starts pregnancy causes arkansas biography leisure attractions learned transactions notebook explorer historic attached opened tm husband disabled authorized crazy upcoming britain concert retirement scores financing efficiency sp comedy adopted efficient weblog linear commitment specialty bears jean hop carrier edited constant visa mouth jewish meter linked portland interviews concepts nh gun reflect pure deliver wonder lessons fruit begins qualified reform lens alerts treated discovery draw mysql classified relating assume confidence alliance fm confirm warm neither lewis howard offline leaves engineer lifestyle consistent replace clearance connections inventory converter organisation babe checks reached",
  "becoming safari objective indicated sugar crew legs sam stick securities allen pdt relation enabled genre slide montana volunteer tested rear democratic enhance switzerland exact bound parameter adapter processor node formal dimensions contribute lock hockey storm micro colleges laptops mile showed challenges editors mens threads bowl supreme brothers recognition presents ref tank submission dolls estimate encourage navy kid regulatory inspection consumers cancel limits territory transaction manchester weapons paint delay pilot outlet contributions continuous db czech resulting cambridge initiative novel pan execution disability increases ultra winner idaho contractor ph episode examination potter dish plays bulletin ia pt indicates modify oxford adam truly epinions painting committed extensive affordable universe candidate databases patent slot psp outstanding ha eating perspective planned watching lodge messenger mirror tournament consideration ds discounts sterling sessions kernel",
  "stocks buyers journals gray catalogue ea jennifer antonio charged broad taiwan und chosen demo greece lg swiss sarah clark labour hate terminal publishers nights behalf caribbean liquid rice nebraska loop salary reservation foods gourmet guard properly orleans saving nfl remaining empire resume twenty newly raise prepare avatar gary depending illegal expansion vary hundreds rome arab lincoln helped premier tomorrow purchased milk decide consent drama visiting performing downtown keyboard contest collected nw bands boot suitable ff absolutely millions lunch audit push chamber guinea findings muscle featuring iso implement clicking scheduled polls typical tower yours sum misc calculator significantly chicken temporary attend shower alan sending jason tonight dear sufficient holdem shell province catholic oak vat awareness vancouver governor beer seemed contribution measurement swimming spyware formula constitution packaging solar jose catch jane pakistan ps reliable consultation",
  "northwest sir doubt earn finder unable periods classroom tasks democracy attacks kim wallpaper merchandise const resistance doors symptoms resorts biggest memorial visitor twin forth insert baltimore gateway ky dont alumni drawing candidates charlotte ordered biological fighting transition happens preferences spy romance instrument bruce split themes powers heaven br bits pregnant twice classification focused egypt physician hollywood bargain wikipedia cellular norway vermont asking blocks normally lo spiritual hunting diabetes suit ml shift chip res sit bodies photographs cutting wow simon writers marks flexible loved favourites mapping numerous relatively birds satisfaction represents char indexed pittsburgh superior preferred saved paying cartoon shots intellectual moore granted choices carbon spending comfortable magnetic interaction listening effectively registry crisis outlook massive denmark employed bright treat header cs poverty formed piano echo que grid sheets patrick",
  "experimental puerto revolution consolidation displays plasma allowing earnings voip mystery landscape dependent mechanical journey delaware bidding consultants risks banner applicant charter fig barbara cooperation counties acquisition ports implemented sf directories recognized dreams blogger notification kg licensing stands teach occurred textbooks rapid pull hairy diversity cleveland ut reverse deposit seminar investments latina nasa wheels specify accessibility dutch sensitive templates formats tab depends boots holds router concrete si editing poland folder womens css completion upload pulse universities technique contractors voting courts notices subscriptions calculate mc detroit alexander broadcast converted metro toshiba anniversary improvements strip specification pearl accident nick accessible accessory resident plot qty possibly airline typically representation regard pump exists arrangements smooth conferences uniprotkb strike consumption birmingham flashing lp narrow",
  "afternoon threat surveys sitting putting consultant controller ownership committees legislative researchers vietnam trailer anne castle gardens missed malaysia unsubscribe antique labels willing bio molecular acting heads stored exam logos residence attorneys antiques density hundred ryan operators strange sustainable philippines statistical beds mention innovation pcs employers grey parallel honda amended operate bills bold bathroom stable opera definitions von doctors lesson cinema asset ag scan elections drinking reaction blank enhanced entitled severe generate stainless newspapers hospitals vi deluxe humor aged monitors exception lived duration bulk successfully indonesia pursuant sci fabric edt visits primarily tight domains capabilities pmid contrast recommendation flying recruitment sin berlin cute organized ba para siemens adoption improving cr expensive meant capture pounds buffalo organisations plane pg explained seed programmes desire expertise mechanism camping ee jewellery",
  "meets welfare peer caught eventually marked driven measured medline bottle agreements considering innovative marshall massage rubber conclusion closing tampa thousand meat legend grace susan ing ks adams python monster alex bang villa bone columns disorders bugs collaboration hamilton detection ftp cookies inner formation tutorial med engineers entity cruises gate holder proposals moderator sw tutorials settlement portugal lawrence roman duties valuable tone collectables ethics forever dragon busy captain fantastic imagine brings heating leg neck hd wing governments purchasing scripts abc stereo appointed taste dealing commit tiny operational rail airlines liberal livecam jay trips gap sides tube turns corresponding descriptions cache belt jacket determination animation oracle er matthew lease productions aviation hobbies proud excess disaster console commands jr telecommunications instructor giant achieved injuries shipped seats approaches biz alarm voltage anthony nintendo usual",
  "loading stamps appeared franklin angle rob vinyl highlights mining designers melbourne ongoing worst imaging betting scientists liberty wyoming blackjack argentina era convert possibility analyst commissioner dangerous garage exciting reliability thongs gcc unfortunately respectively volunteers attachment ringtone finland morgan derived pleasure honor asp oriented eagle desktops pants columbus nurse prayer appointment workshops hurricane quiet luck postage producer represented mortgages dial responsibilities cheese comic carefully jet productivity investors crown par underground diagnosis maker crack principle picks vacations gang semester calculated fetish applies casinos appearance smoke apache filters incorporated nv craft cake notebooks apart fellow blind lounge mad algorithm semi coins andy gross strongly cafe valentine hilton ken proteins horror su exp familiar capable douglas debian till involving pen investing christopher admission epson shoe elected carrying victory sand",
  "madison terrorism joy editions cpu mainly ethnic ran parliament actor finds seal situations fifth allocated citizen vertical corrections structural municipal describes prize sr occurs jon absolute disabilities consists anytime substance prohibited addressed lies pipe soldiers nr guardian lecture simulation layout initiatives ill concentration classics lbs lay interpretation horses lol dirty deck wayne donate taught bankruptcy mp worker optimization alive temple substances prove discovered wings breaks genetic restrictions participating waters promise thin exhibition prefer ridge cabinet modem harris mph bringing sick dose evaluate tiffany tropical collect bet composition toyota streets nationwide vector definitely shaved turning buffer purple existence commentary larry limousines developments def immigration destinations lets mutual pipeline necessarily syntax li attribute prison skill chairs nl everyday apparently surrounding mountains moves popularity inquiry ethernet checked exhibit",
  "throw trend sierra visible cats desert postposted ya oldest rhode nba coordinator obviously mercury steven handbook greg navigate worse summit victims epa spaces fundamental burning escape coupons somewhat receiver substantial tr progressive cialis bb boats glance scottish championship arcade richmond sacramento impossible ron russell tells obvious fiber depression graph covering platinum judgment bedrooms talks filing foster modeling passing awarded testimonials trials tissue nz memorabilia clinton masters bonds cartridge alberta explanation folk org commons cincinnati subsection fraud electricity permitted spectrum arrival okay pottery emphasis roger aspect workplace awesome mexican confirmed counts priced wallpapers hist crash lift desired inter closer assumes heights shadow riding infection firefox lisa expense grove eligibility venture clinic korean healing princess mall entering packet spray studios involvement dad buttons placement observations vbulletin funded thompson winners",
  "extend roads subsequent pat dublin rolling fell motorcycle yard disclosure establishment memories nelson te arrived creates faces tourist av mayor murder sean adequate senator yield presentations grades cartoons pour digest reg lodging tion dust hence wiki entirely replaced radar rescue undergraduate losses combat reducing stopped occupation lakes donations associations citysearch closely radiation diary seriously kings shooting kent adds nsw ear flags pci baker launched elsewhere pollution conservative guestbook shock effectiveness walls abroad ebony tie ward drawn arthur ian visited roof walker demonstrate atmosphere suggests kiss beast ra operated experiment targets overseas purchases dodge counsel federation pizza invited yards assignment chemicals gordon mod farmers rc queries bmw rush ukraine absence nearest cluster vendors mpeg whereas yoga serves woods surprise lamp rico partial shoppers phil everybody couples nashville ranking jokes cst http ceo simpson twiki sublime",
  "counseling palace acceptable satisfied glad wins measurements verify globe trusted copper milwaukee rack medication warehouse shareware ec rep dicke kerry receipt supposed ordinary nobody ghost violation configure stability mit applying southwest boss pride institutional expectations independence knowing reporter metabolism keith champion cloudy linda ross personally chile anna plenty solo sentence throat ignore maria uniform excellence wealth tall rm somewhere vacuum dancing attributes recognize brass writes plaza pdas outcomes survival quest publish sri screening toe thumbnail trans jonathan whenever nova lifetime api pioneer booty forgotten acrobat plates acres venue athletic thermal essays behaviour vital telling fairly coastal config cf charity intelligent edinburgh vt excel modes obligation campbell wake stupid harbor hungary traveler urw segment realize regardless lan enemy puzzle rising aluminum wells wishlist opens insight sms restricted republican secrets lucky latter",
  "merchants thick trailers repeat syndrome philips attendance penalty drum glasses enables nec iraqi builder vista jessica chips terry flood foto ease arguments amsterdam arena adventures pupils stewart announcement tabs outcome appreciate expanded casual grown polish lovely extras gm centres jerry clause smile lands ri troops indoor bulgaria armed broker charger regularly believed pine cooling tend gulf rt rick trucks cp mechanisms divorce laura shopper tokyo partly nikon customize tradition candy pills tiger donald folks sensor exposed telecom hunt angels deputy indicators sealed thai emissions physicians loaded fred complaint scenes experiments afghanistan dd boost spanking scholarship governance mill founded supplements chronic icons moral den catering aud finger keeps pound locate camcorder pl trained burn implementing roses labs ourselves bread tobacco wooden motors tough roberts incident gonna dynamics lie crm rf conversation decrease chest pension billy revenues emerging worship",
  "capability ak fe craig herself producing churches precision damages reserves contributed solve shorts reproduction minority td diverse amp ingredients sb ah johnny sole franchise recorder complaints facing sm nancy promotions tones passion rehabilitation maintaining sight laid clay defence patches weak refund usc towns environments trembl divided blvd reception amd wise emails cyprus wv odds correctly insider seminars consequences makers hearts geography appearing integrity worry ns discrimination eve carter legacy marc pleased danger vitamin widely processed phrase genuine raising implications functionality paradise hybrid reads roles intermediate emotional sons leaf pad glory platforms ja bigger billing diesel versus combine overnight geographic exceed bs rod saudi fault cuba hrs preliminary districts introduce silk promotional kate chevrolet babies bi karen compiled romantic revealed specialists generator albert examine jimmy graham suspension bristol margaret compaq sad correction",
  "wolf slowly authentication communicate rugby supplement showtimes cal portions infant promoting sectors samuel fluid grounds fits kick regards meal ta hurt machinery bandwidth unlike equation baskets probability pot dimension wright img barry proven schedules admissions cached warren slip studied reviewer involves quarterly rpm profits devil grass comply marie florist illustrated cherry continental alternate deutsch achievement limitations kenya webcam cuts funeral nutten earrings enjoyed automated chapters pee charlie quebec passenger convenient dennis mars francis tvs sized manga noticed socket silent literary egg mhz signals caps orientation pill theft childhood swing symbols lat meta humans analog facial choosing talent dated flexibility seeker wisdom shoot boundary mint packard offset payday philip elite gi spin holders believes swedish poems deadline jurisdiction robot displaying witness collins equipped stages encouraged sur winds powder broadway acquired assess wash cartridges",
  "stones entrance gnome roots declaration losing attempts gadgets noble glasgow automation impacts rev gospel advantages shore loves induced ll knight preparing loose aims recipient linking extensions appeals cl earned illness islamic athletics southeast ieee ho alternatives pending parker determining lebanon corp personalized kennedy gt sh conditioning teenage soap ae triple cooper nyc vincent jam secured unusual answered partnerships destruction slots increasingly migration disorder routine toolbar basically rocks conventional titans applicants wearing axis sought genes mounted habitat firewall median guns scanner herein occupational animated judicial rio hs adjustment hero integer treatments bachelor attitude camcorders engaged falling basics montreal carpet rv struct lenses binary genetics attended difficulty punk collective coalition pi dropped enrollment duke walter ai pace besides wage producers ot collector arc hosts interfaces advertisers moments atlas strings dawn representing",
  "observation feels torture carl deleted coat mitchell mrs rica restoration convenience returning ralph opposition container yr defendant warner confirmation app embedded inkjet supervisor wizard corps actors liver peripherals liable brochure morris bestsellers petition eminem recall antenna picked assumed departure minneapolis belief killing bikini memphis shoulder decor lookup texts harvard brokers roy ion diameter ottawa doll ic podcast seasons peru interactions refine bidder singer evans herald literacy fails aging nike intervention fed plugin attraction diving invite modification alice latinas suppose customized reed involve moderate terror younger thirty mice opposite understood rapidly dealtime ban temp intro mercedes zus assurance clerk happening vast mills outline amendments tramadol holland receives jeans metropolitan compilation verification fonts ent odd wrap refers mood favor veterans quiz mx sigma gr attractive xhtml occasion recordings jefferson victim demands sleeping",
  "careful ext beam gardening obligations arrive orchestra sunset tracked moreover minimal polyphonic lottery tops framed aside outsourcing licence adjustable allocation michelle essay discipline amy ts demonstrated dialogue identifying alphabetical camps declared dispatched aaron handheld trace disposal shut florists packs ge installing switches romania voluntary ncaa thou consult phd greatly blogging mask cycling midnight ng commonly pe photographer inform turkish coal cry messaging pentium quantum murray intent tt zoo largely pleasant announce constructed additions requiring spoke aka arrow engagement sampling rough weird tee refinance lion inspired holes weddings blade suddenly oxygen cookie meals canyon goto meters merely calendars arrangement conclusions passes bibliography pointer compatibility stretch durham furthermore permits cooperative muslim xl neil sleeve netscape cleaner cricket beef feeding stroke township rankings measuring cad hats robin robinson jacksonville strap",
  "headquarters sharon crowd tcp transfers surf olympic transformation remained attachments dv dir entities customs administrators personality rainbow hook roulette decline gloves israeli medicare cord skiing cloud facilitate subscriber valve val hewlett explains proceed flickr feelings knife jamaica priorities shelf bookstore timing liked parenting adopt denied fotos incredible britney freeware donation outer crop deaths rivers commonwealth pharmaceutical manhattan tales katrina workforce islam nodes tu fy thumbs seeds cited lite ghz hub targeted organizational skype realized twelve founder decade gamecube rr dispute portuguese tired titten adverse everywhere excerpt eng steam discharge ef drinks ace voices acute halloween climbing stood sing tons perfume carol honest albany hazardous restore stack methodology somebody sue ep housewares reputation resistant democrats recycling hang gbp curve creator amber qualifications museums coding slideshow tracker variation passage transferred trunk",
  "hiking lb pierre jelsoft headset photograph oakland colombia waves camel distributor lamps underlying hood wrestling suicide archived photoshop jp chi bt arabia gathering projection juice chase mathematical logical sauce fame extract specialized diagnostic panama indianapolis af payable corporations courtesy criticism automobile confidential rfc statutory accommodations athens northeast downloaded judges sl seo retired isp remarks detected decades paintings walked arising nissan bracelet ins eggs juvenile injection yorkshire populations protective afraid acoustic railway cassette initially indicator pointed hb jpg causing mistake norton locked eliminate tc fusion mineral sunglasses ruby steering beads fortune preference canvas threshold parish claimed screens cemetery planner croatia flows stadium venezuela exploration mins fewer sequences coupon nurses ssl stem proxy astronomy lanka opt edwards drew contests flu translate announces mlb costume tagged berkeley voted killer bikes gates",
  "adjusted rap tune bishop pulled corn gp shaped compression seasonal establishing farmer counters puts constitutional grew perfectly tin slave instantly cultures norfolk coaching examined trek encoding litigation submissions oem heroes painted lycos ir zdnet broadcasting horizontal artwork cosmetic resulted portrait terrorist informational ethical carriers ecommerce mobility floral builders ties struggle schemes suffering neutral fisher rat spears prospective bedding ultimately joining heading equally artificial bearing spectacular coordination connector brad combo seniors worlds guilty affiliated activation naturally haven tablet jury dos tail subscribers charm lawn violent mitsubishi underwear basin soup potentially ranch constraints crossing inclusive dimensional cottage drunk considerable crimes resolved mozilla byte toner nose latex branches anymore oclc delhi holdings alien locator selecting processors pantyhose plc broke nepal zimbabwe difficulties juan complexity msg constantly",
  "browsing resolve barcelona presidential documentary cod territories melissa moscow thesis thru jews nylon palestinian discs rocky bargains frequent trim nigeria ceiling pixels ensuring hispanic cv cb legislature hospitality gen anybody procurement diamonds espn fleet untitled bunch totals marriott singing theoretical afford exercises starring referral nhl surveillance optimal quit distinct protocols lung highlight substitute inclusion hopefully brilliant turner sucking cents reuters ti fc gel todd spoken omega evaluated stayed civic assignments fw manuals doug sees termination watched saver thereof grill households gs redeem rogers grain aaa authentic regime wanna wishes bull montgomery architectural louisville depend differ macintosh movements ranging monica repairs breath amenities virtually cole mart candle hanging colored authorization tale verified lynn formerly projector bp situated comparative std seeks herbal loving strictly routing docs stanley psychological surprised retailer",
  "vitamins elegant gains renewal vid genealogy opposed deemed scoring expenditure brooklyn liverpool sisters critics connectivity spots oo algorithms hacker madrid similarly margin coin solely fake salon collaborative norman fda excluding turbo headed voters cure madonna commander arch ni murphy thinks thats suggestion hdtv soldier phillips asin aimed justin bomb harm interval mirrors spotlight tricks reset brush investigate thy expansys panels repeated assault connecting spare logistics deer kodak tongue bowling tri danish pal monkey proportion filename skirt florence invest honey um analyses drawings significance scenario ye fs lovers atomic approx symposium arabic gauge essentials junction protecting nn faced mat rachel solving transmitted weekends screenshots produces oven ted intensive chains kingston sixth engage deviant noon switching quoted adapters correspondence farms imports supervision cheat bronze expenditures sandy separation testimony suspect celebrities macro sender",
  "mandatory boundaries crucial syndication gym celebration kde adjacent filtering tuition spouse exotic viewer signup threats luxembourg puzzles reaching vb damaged cams receptor laugh joel surgical destroy citation pitch autos yo premises perry proved offensive imperial dozen benjamin deployment teeth cloth studying colleagues stamp lotus salmon olympus separated proc cargo tan directive fx salem mate dl starter upgrades likes butter pepper weapon luggage burden chef tapes zones races isle stylish slim maple luke grocery offshore governing retailers depot kenneth comp alt pie blend harrison ls julie occasionally cbs attending emission pete spec finest realty janet bow penn recruiting apparent instructional phpbb autumn traveling probe midi permissions biotechnology toilet ranked jackets routes packed excited outreach helen mounting recover tied lopez balanced prescribed catherine timely talked debug delayed chuck reproduced hon dale explicit calculation villas ebook consolidated exclude",
  "peeing occasions brooks equations newton oils sept exceptional anxiety bingo whilst spatial respondents unto lt ceramic prompt precious minds annually considerations scanners atm xanax eq pays fingers sunny ebooks delivers je queensland necklace musicians leeds composite unavailable cedar arranged lang theaters advocacy raleigh stud fold essentially designing threaded uv qualify blair hopes assessments cms mason diagram burns pumps footwear sg vic beijing peoples victor mario pos attach licenses utils removing advised brunswick spider phys ranges pairs sensitivity trails preservation hudson isolated calgary interim assisted divine streaming approve chose compound intensity technological syndicate abortion dialog venues blast wellness calcium newport antivirus addressing pole discounted indians shield harvest membrane prague previews bangladesh constitute locally concluded pickup desperate mothers nascar iceland demonstration governmental manufactured candles graduation mega bend",
  "sailing variations moms sacred addiction morocco chrome tommy springfield refused brake exterior greeting ecology oliver congo glen botswana nav delays synthesis olive undefined unemployment cyber verizon scored enhancement newcastle clone velocity lambda relay composed tears performances oasis baseline cab angry fa societies silicon brazilian identical petroleum compete ist norwegian lover belong honolulu beatles lips retention exchanges pond rolls thomson barnes soundtrack wondering malta daddy lc ferry rabbit profession seating dam cnn separately physiology lil collecting das exports omaha tire participant scholarships recreational dominican chad electron loads friendship heather passport motel unions treasury warrant sys solaris frozen occupied josh royalty scales rally observer sunshine strain drag ceremony somehow arrested expanding provincial investigations icq ripe yamaha rely medications hebrew gained rochester dying laundry stuck solomon placing stops homework adjust assessed",
  "advertiser enabling encryption filling downloadable sophisticated imposed silence scsi focuses soviet possession cu laboratories treaty vocal trainer organ stronger volumes advances vegetables lemon toxic dns thumbnails darkness pty ws nuts nail bizrate vienna implied span stanford sox stockings joke respondent packing statute rejected satisfy destroyed shelter chapel gamespot manufacture layers wordpress guided vulnerability accountability celebrate accredited appliance compressed bahamas powell mixture bench univ tub rider scheduling radius perspectives mortality logging hampton christians borders therapeutic pads butts inns bobby impressive sheep accordingly architect railroad lectures challenging wines nursery harder cups ash microwave cheapest accidents travesti relocation stuart contributors salvador ali salad np monroe tender violations foam temperatures paste clouds competitions discretion tft tanzania preserve jvc poem unsigned staying cosmetics easter theories repository",
  "praise jeremy venice concentrations estonia christianity veteran streams landing signing executed katie negotiations realistic dt cgi showcase integral asks relax namibia generating christina congressional synopsis hardly prairie reunion composer bean sword absent photographic sells ecuador hoping accessed spirits modifications coral pixel float colin bias imported paths bubble por acquire contrary millennium tribune vessel acids focusing viruses cheaper admitted dairy admit mem fancy equality samoa gc achieving tap stickers fisheries exceptions reactions leasing lauren beliefs ci macromedia companion squad analyze ashley scroll relate divisions swim wages additionally suffer forests fellowship nano invalid concerts martial males victorian retain colours execute tunnel genres cambodia patents copyrights yn chaos lithuania mastercard wheat chronicles obtaining beaver updating distribute readings decorative kijiji confused compiler enlargement eagles bases vii accused bee campaigns unity",
  "loud conjunction bride rats defines airports instances indigenous begun cfr brunette packets anchor socks validation parade corruption stat trigger incentives cholesterol gathered essex slovenia notified differential beaches folders dramatic surfaces terrible routers cruz pendant dresses baptist scientist starsmerchant hiring clocks arthritis bios females wallace nevertheless reflects taxation fever pmc cuisine surely practitioners transcript myspace theorem inflation thee nb ruth pray stylus compounds pope drums contracting arnold structured reasonably jeep chicks bare hung cattle mba radical graduates rover recommends controlling treasure reload distributors flame levitra tanks assuming monetary elderly pit arlington mono particles floating extraordinary tile indicating bolivia spell hottest stevens coordinate kuwait exclusively emily alleged limitation widescreen compile webster struck rx illustration plymouth warnings construct apps inquiries bridal annex mag gsm inspiration tribal",
  "curious affecting freight rebate meetup eclipse sudan ddr downloading rec shuttle aggregate stunning cycles affects forecasts detect actively ciao ampland knee prep pb complicated chem fastest butler shopzilla injured decorating payroll cookbook expressions ton courier uploaded shakespeare hints collapse americas connectors unlikely oe gif pros conflicts techno beverage tribute wired elvis immune latvia travelers forestry barriers cant jd rarely gpl infected offerings martha genesis barrier argue incorrect trains metals bicycle furnishings letting arise guatemala celtic thereby irc jamie particle perception minerals advise humidity bottles boxing wy dm bangkok renaissance pathology sara bra ordinance hughes photographers infections jeffrey chess operates brisbane configured survive oscar festivals menus joan possibilities duck reveal canal amino phi contributing herbs clinics mls cow manitoba analytical missions watson lying costumes strict dive saddam circulation drill offense bryan",
  "cet protest assumption jerusalem hobby tries transexuales invention nickname fiji technician inline executives enquiries washing audi staffing cognitive exploring trick enquiry closure raid ppc timber volt intense div playlist registrar showers supporters ruling steady dirt statutes withdrawal myers drops predicted wider saskatchewan jc cancellation plugins enrolled sensors screw ministers publicly hourly blame geneva freebsd veterinary acer prostores reseller dist handed suffered intake informal relevance incentive butterfly tucson mechanics heavily swingers fifty headers mistakes numerical ons geek uncle defining counting reflection sink accompanied assure invitation devoted princeton jacob sodium randy spirituality hormone meanwhile proprietary timothy childrens brick grip naval thumbzilla medieval porcelain avi bridges pichunter captured watt thehun decent casting dayton translated shortly cameron columnists pins carlos reno donna andreas warrior diploma cabin innocent scanning ide",
  "consensus polo valium copying rpg delivering cordless patricia horn eddie uganda fired journalism pd prot trivia adidas perth frog grammar intention syria disagree klein harvey tires logs undertaken tgp hazard retro leo statewide semiconductor gregory episodes boolean circular anger diy mainland illustrations suits chances interact snap happiness arg substantially bizarre glenn ur auckland olympics fruits identifier geo ribbon calculations doe jpeg conducting startup suzuki trinidad ati kissing wal handy swap exempt crops reduces accomplished calculators geometry impression abs slovakia flip guild correlation gorgeous capitol sim dishes rna barbados chrysler nervous refuse extends fragrance mcdonald replica plumbing brussels tribe neighbors trades superb buzz transparent nuke rid trinity charleston handled legends boom calm champions floors selections projectors inappropriate exhaust comparing shanghai speaks burton vocational davidson copied scotia farming gibson pharmacies fork troy",
  "ln roller introducing batch organize appreciated alter nicole latino ghana edges uc mixing handles skilled fitted albuquerque harmony distinguished asthma projected assumptions shareholders twins developmental rip zope regulated triangle amend anticipated oriental reward windsor zambia completing gmbh buf ld hydrogen webshots sprint comparable chick advocate sims confusion copyrighted tray inputs warranties genome escorts documented thong medal paperbacks coaches vessels harbour walks sol keyboards sage knives eco vulnerable arrange artistic bat honors booth indie reflected unified bones breed detector ignored polar fallen precise sussex respiratory notifications msgid transexual mainstream invoice evaluating lip subcommittee sap gather suse maternity backed alfred colonial mf carey motels forming embassy cave journalists danny rebecca slight proceeds indirect amongst wool foundations msgstr arrest volleyball mw adipex horizon nu deeply toolbox ict marina liabilities prizes bosnia",
  "browsers decreased patio dp tolerance surfing creativity lloyd describing optics pursue lightning overcome eyed ou quotations grab inspector attract brighton beans bookmarks ellis disable snake succeed leonard lending oops reminder xi searched behavioral riverside bathrooms plains sku ht raymond insights abilities initiated sullivan za midwest karaoke trap lonely fool ve nonprofit lancaster suspended hereby observe julia containers attitudes karl berry collar simultaneously racial integrate bermuda amanda sociology mobiles screenshot exhibitions kelkoo confident retrieved exhibits officially consortium dies terrace bacteria pts replied seafood novels rh rrp recipients ought delicious traditions fg jail safely finite kidney periodically fixes sends durable mazda allied throws moisture hungarian roster referring symantec spencer wichita nasdaq uruguay ooo hz transform timer tablets tuning gotten educators tyler futures vegetable verse highs humanities independently wanting custody",
  "scratch launches ipaq alignment henderson bk britannica comm ellen competitors nhs rocket aye bullet towers racks lace nasty visibility latitude consciousness ste tumor ugly deposits beverly mistress encounter trustees watts duncan reprints hart bernard resolutions ment accessing forty tubes attempted col midlands priest floyd ronald analysts queue dx sk trance locale nicholas biol yu bundle hammer invasion witnesses runner rows administered notion sq skins mailed oc fujitsu spelling arctic exams rewards beneath strengthen defend aj frederick medicaid treo infrared seventh gods une welsh belly aggressive tex advertisements quarters stolen cia soonest haiti disturbed determines sculpture poly ears dod wp fist naturals neo motivation lenders pharmacology fitting fixtures bloggers mere agrees passengers quantities petersburg consistently powerpoint cons surplus elder sonic obituaries cheers dig taxi punishment appreciation subsequently om belarus nat zoning gravity providence thumb",
  "restriction incorporate backgrounds treasurer guitars essence flooring lightweight ethiopia tp mighty athletes humanity transcription jm holmes complications scholars dpi scripting gis remembered galaxy chester snapshot caring loc worn synthetic shaw vp segments testament expo dominant twist specifics itunes stomach partially buried cn newbie minimize darwin ranks wilderness debut generations tournaments bradley deny anatomy bali judy sponsorship headphones fraction trio proceeding cube defects volkswagen uncertainty breakdown milton marker reconstruction subsidiary strengths clarity rugs sandra adelaide encouraging furnished monaco settled folding emirates terrorists airfare comparisons beneficial distributions vaccine belize fate viewpicture promised volvo penny robust bookings threatened minolta republicans discusses gui porter gras jungle ver rn responded rim abstracts zen ivory alpine dis prediction pharmaceuticals andale fabulous remix alias thesaurus individually battlefield",
  "literally newer kay ecological spice oval implies cg soma ser cooler appraisal consisting maritime periodic submitting overhead ascii prospect shipment breeding citations geographical donor mozambique tension href benz trash shapes wifi tier fwd earl manor envelope diane homeland disclaimers championships excluded andrea breeds rapids disco sheffield bailey aus endif finishing emotions wellington incoming prospects lexmark cleaners bulgarian hwy eternal cashiers guam cite aboriginal remarkable rotation nam preventing productive boulevard eugene ix gdp pig metric compliant minus penalties bennett imagination hotmail refurbished joshua armenia varied grande closest activated actress mess conferencing assign armstrong politicians trackbacks lit accommodate tigers aurora una slides milan premiere lender villages shade chorus christine rhythm digit argued dietary symphony clarke sudden accepting precipitation marilyn lions findlaw ada pools tb lyric claire isolation speeds sustained matched",
  "approximate rope carroll rational programmer fighters chambers dump greetings inherited warming incomplete vocals chronicle fountain chubby grave legitimate biographies burner yrs foo investigator gba plaintiff finnish gentle bm prisoners deeper muslims hose mediterranean nightlife footage howto worthy reveals architects saints entrepreneur carries sig freelance duo excessive devon screensaver helena saves regarded valuation unexpected cigarette fog characteristic marion lobby egyptian tunisia metallica outlined consequently headline treating punch appointments str gotta cowboy narrative bahrain enormous karma consist betty queens academics pubs quantitative lucas screensavers subdivision tribes vip defeat clicks distinction honduras naughty hazards insured harper livestock mardi exemption tenant sustainability cabinets tattoo shake algebra shadows holly formatting silly nutritional yea mercy hartford freely marcus sunrise wrapping mild fur nicaragua weblogs timeline tar belongs rj",
  "readily affiliation soc fence nudist infinite diana ensures relatives lindsay clan legally shame satisfactory revolutionary bracelets sync civilian telephony mesa fatal remedy realtors breathing briefly thickness adjustments graphical genius discussing aerospace fighter meaningful flesh retreat adapted barely wherever estates rug democrat borough maintains failing shortcuts ka retained voyeurweb pamela andrews marble extending jesse specifies hull logitech surrey briefing belkin dem accreditation wav blackberry highland meditation modular microphone macedonia combining brandon instrumental giants organizing shed balloon moderators winston memo ham solved tide kazakhstan hawaiian standings partition invisible gratuit consoles funk fbi qatar magnet translations porsche cayman jaguar reel sheer commodity posing kilometers rp bind thanksgiving rand hopkins urgent guarantees infants gothic cylinder witch buck indication eh congratulations tba cohen sie usgs puppy kathy acre graphs surround",
  "cigarettes revenge expires enemies lows controllers aqua chen emma consultancy finances accepts enjoying conventions eva patrol smell pest hc italiano coordinates rca fp carnival roughly sticker promises responding reef physically divide stakeholders hydrocodone gst consecutive cornell satin bon deserve attempting mailto promo jj representations chan worried tunes garbage competing combines mas beth bradford len phrases kai peninsula chelsea boring reynolds dom jill accurately speeches reaches schema considers sofa catalogs ministries vacancies quizzes parliamentary obj prefix lucia savannah barrel typing nerve dans planets deficit boulder pointing renew coupled viii myanmar metadata harold circuits floppy texture handbags jar ev somerset incurred acknowledge thoroughly antigua nottingham thunder tent caution identifies questionnaire qualification locks modelling namely miniature dept hack dare euros interstate pirates aerial hawk consequence rebel systematic perceived origins hired",
  "makeup textile lamb madagascar nathan tobago presenting cos troubleshooting uzbekistan indexes pac rl erp centuries gl magnitude ui richardson hindu dh fragrances vocabulary licking earthquake vpn fundraising fcc markers weights albania geological assessing lasting wicked eds introduces kills roommate webcams pushed webmasters ro df computational acdbentity participated junk handhelds wax lucy answering hans impressed slope reggae failures poet conspiracy surname theology nails evident whats rides rehab epic saturn organizer nut allergy sake twisted combinations preceding merit enzyme cumulative zshops planes edmonton tackle disks condo pokemon amplifier ambien arbitrary prominent retrieve lexington vernon sans worldcat titanium irs fairy builds contacted shaft lean bye cdt recorders occasional leslie casio deutsche ana postings innovations kitty postcards dude drain monte fires algeria blessed luis reviewing cardiff cornwall favors potato panic explicitly sticks leone transsexual ez",
  "citizenship excuse reforms basement onion strand pf sandwich uw lawsuit alto informative girlfriend bloomberg cheque hierarchy influenced banners reject eau abandoned bd circles italic beats merry mil scuba gore complement cult dash passive mauritius valued cage checklist requesting courage verde lauderdale scenarios gazette hitachi divx extraction batman elevation hearings coleman hugh lap utilization beverages calibration jake eval efficiently anaheim ping textbook dried entertaining prerequisite luther frontier settle stopping refugees knights hypothesis palmer medicines flux derby sao peaceful altered pontiac regression doctrine scenic trainers muze enhancements renewable intersection passwords sewing consistency collectors conclude recognised munich oman celebs gmc propose hh azerbaijan lighter rage adsl uh prix astrology advisors pavilion tactics trusts occurring supplemental travelling talented annie pillow induction derek precisely shorter harley spreading provinces relying",
  "finals paraguay steal parcel refined fd bo fifteen widespread incidence fears predict boutique acrylic rolled tuner avon incidents peterson rays asn shannon toddler enhancing flavor alike walt homeless horrible hungry metallic acne blocked interference warriors palestine listprice libs undo cadillac atmospheric malawi wm pk sagem knowledgestorm dana halo ppm curtis parental referenced strikes lesser publicity marathon ant proposition gays pressing gasoline apt dressed scout belfast exec dealt niagara inf eos warcraft charms catalyst trader bucks allowance vcr denial uri designation thrown prepaid raises gem duplicate electro criterion badge wrist civilization analyzed vietnamese heath tremendous ballot lexus varying remedies validity trustee maui weighted angola performs plastics realm corrected jenny helmet salaries postcard elephant yemen encountered tsunami scholar nickel internationally surrounded psi buses expedia geology pct wb creatures coating commented wallet cleared smilies",
  "vids accomplish boating drainage shakira corners broader vegetarian rouge yeast yale newfoundland sn qld pas clearing investigated dk ambassador coated intend stephanie contacting vegetation doom findarticles louise kenny specially owen routines hitting yukon beings bite issn aquatic reliance habits striking myth infectious podcasts singh gig gilbert sas ferrari continuity brook fu outputs phenomenon ensemble insulin assured biblical weed conscious accent mysimon eleven wives ambient utilize mileage oecd prostate adaptor auburn unlock hyundai pledge vampire angela relates nitrogen xerox dice merger softball referrals quad dock differently firewire mods nextel framing organised musician blocking rwanda sorts integrating vsnet limiting dispatch revisions papua restored hint armor riders chargers remark dozens varies msie reasoning wn liz rendered picking charitable guards annotated ccd sv convinced openings buys burlington replacing researcher watershed councils occupations acknowledged",
  "kruger pockets granny pork zu equilibrium viral inquire pipes characterized laden aruba cottages realtor merge privilege edgar develops qualifying chassis dubai estimation barn pushing llp fleece pediatric boc fare dg asus pierce allan dressing techrepublic sperm vg bald filme craps fuji frost leon institutes mold dame fo sally yacht tracy prefers drilling brochures herb tmp ate breach whale traveller appropriations suspected tomatoes benchmark beginners instructors highlighted bedford stationery idle mustang unauthorized clusters antibody competent momentum fin wiring io pastor mud calvin uni shark contributor demonstrates phases grateful emerald gradually laughing grows cliff desirable tract ul ballet ol journalist abraham js bumper afterwards webpage religions garlic hostels shine senegal explosion pn banned wendy briefs signatures diffs cove mumbai ozone disciplines casa mu daughters conversations radios tariff nvidia opponent pasta simplified muscles serum wrapped swift",
  "motherboard runtime inbox focal bibliographic eden distant incl champagne ala decimal hq deviation superintendent propecia dip nbc samba hostel housewives employ mongolia penguin magical influences inspections irrigation miracle manually reprint reid wt hydraulic centered robertson flex yearly penetration wound belle rosa conviction hash omissions writings hamburg lazy mv mpg retrieval qualities cindy fathers carb charging cas marvel lined cio dow prototype importantly rb petite apparatus upc terrain dui pens explaining yen strips gossip rangers nomination empirical mh rotary worm dependence discrete beginner boxed lid sexuality polyester cubic deaf commitments suggesting sapphire kinase skirts mats remainder crawford labeled privileges televisions specializing marking commodities pvc serbia sheriff griffin declined guyana spies blah mime neighbor motorcycles elect highways thinkpad concentrate intimate reproductive preston deadly feof bunny chevy molecules rounds longest refrigerator",
  "tions intervals sentences dentists usda exclusion workstation holocaust keen flyer peas dosage receivers urls customise disposition variance navigator investigators cameroon baking marijuana adaptive computed needle baths enb gg cathedral brakes og nirvana ko fairfield owns til invision sticky destiny generous madness emacs climb blowing fascinating landscapes heated lafayette jackie wto computation hay cardiovascular ww sparc cardiac salvation dover adrian predictions accompanying vatican brutal learners gd selective arbitration configuring token editorials zinc sacrifice seekers guru isa removable convergence yields gibraltar levy suited numeric anthropology skating kinda aberdeen emperor grad malpractice dylan bras belts blacks educated rebates reporters burke proudly pix necessity rendering mic inserted pulling basename kyle obesity curves suburban touring clara vertex bw hepatitis nationally tomato andorra waterproof expired mj travels flush waiver pale specialties hayes",
  "humanitarian invitations functioning delight survivor garcia cingular economies alexandria bacterial moses counted undertake declare continuously johns valves gaps impaired achievements donors tear jewel teddy lf convertible ata teaches ventures nil bufing stranger tragedy julian nest pam dryer painful velvet tribunal ruled nato pensions prayers funky secretariat nowhere cop paragraphs gale joins adolescent nominations wesley dim lately cancelled scary mattress mpegs brunei likewise banana introductory slovak cakes stan reservoir occurrence idol mixer remind wc worcester sbjct demographic charming mai tooth disciplinary annoying respected stays disclose affair drove washer upset restrict springer beside mines portraits rebound logan mentor interpreted evaluations fought baghdad elimination metres hypothetical immigrants complimentary helicopter pencil freeze hk performer abu titled commissions sphere powerseller moss ratios concord graduated endorsed ty surprising walnut lance ladder",
  "italia unnecessary dramatically liberia sherman cork maximize cj hansen senators workout mali yugoslavia bleeding characterization colon likelihood lanes purse fundamentals contamination mtv endangered compromise optimize stating dome caroline leu expiration namespace align peripheral bless engaging negotiation crest opponents triumph nominated confidentiality electoral changelog welding deferred alternatively heel alloy condos plots polished yang gently greensboro tulsa locking casey controversial draws fridge blanket bloom qc simpsons lou elliott recovered fraser justify upgrading blades pgp loops surge frontpage trauma aw tahoe advert possess demanding defensive sip flashers subaru forbidden tf vanilla programmers pj monitored installations deutschland picnic souls arrivals spank cw practitioner motivated wr dumb smithsonian hollow vault securely examining fioricet groove revelation rg pursuit delegation wires bl dictionaries mails backing greenhouse sleeps vc blake transparency dee",
  "travis wx endless figured orbit currencies niger bacon survivors positioning heater colony cannon circus promoted forbes mae moldova mel descending paxil spine trout enclosed feat temporarily ntsc cooked thriller transmit apnic fatty gerald pressed frequencies scanned reflections hunger mariah sic municipality usps joyce detective surgeon cement experiencing fireplace endorsement bg planners disputes textiles missile intranet closes seq psychiatry persistent deborah conf marco assists summaries glow gabriel auditor wma aquarium violin prophet cir bracket looksmart isaac oxide oaks magnificent erik colleague naples promptly modems adaptation hu harmful paintball prozac sexually enclosure acm dividend newark kw paso glucose phantom norm playback supervisors westminster turtle ips distances absorption treasures dsc warned neural ware fossil mia hometown badly transcripts apollo wan disappointed persian continually communist collectible handmade greene entrepreneurs robots grenada",
  "creations jade scoop acquisitions foul keno gtk earning mailman sanyo nested biodiversity excitement somalia movers verbal blink presently seas carlo workflow mysterious novelty bryant tiles voyuer librarian subsidiaries switched stockholm tamil garmin ru pose fuzzy indonesian grams therapist richards mrna budgets toolkit promising relaxation goat render carmen ira sen thereafter hardwood erotica temporal sail forge commissioners dense dts brave forwarding qt awful nightmare airplane reductions southampton istanbul impose organisms sega telescope viewers asbestos portsmouth cdna meyer enters pod savage advancement wu harassment willow resumes bolt gage throwing existed generators lu wagon barbie dat favour soa knock urge smtp generates potatoes thorough replication inexpensive kurt receptors peers roland optimum neon interventions quilt huntington creature ours mounts syracuse internship lone refresh aluminium snowboard beastality webcast michel evanescence subtle coordinated notre",
  "shipments maldives stripes firmware antarctica cope shepherd lm canberra cradle chancellor mambo lime kirk flour controversy legendary bool sympathy choir avoiding beautifully blond expects cho jumping fabrics antibodies polymer hygiene wit poultry virtue burst examinations surgeons bouquet immunology promotes mandate wiley departmental bbs spas ind corpus johnston terminology gentleman fibre reproduce convicted shades jets indices roommates adware qui intl threatening spokesman zoloft activists frankfurt prisoner daisy halifax encourages ultram cursor assembled earliest donated stuffed restructuring insects terminals crude morrison maiden simulations cz sufficiently examines viking myrtle bored cleanup yarn knit conditional mug crossword bother budapest conceptual knitting attacked hl bhutan liechtenstein mating compute redhead arrives translator automobiles tractor allah continent ob unwrap fares longitude resist challenged telecharger hoped pike safer insertion instrumentation ids",
  "hugo wagner constraint groundwater touched strengthening cologne gzip wishing ranger smallest insulation newman marsh ricky ctrl scared theta infringement bent laos subjective monsters asylum lightbox robbie stake cocktail outlets swaziland varieties arbor mediawiki configurations poison didn doesn isn wasn wouldn huh couldn aren ain whoa hurry sighs shouldn alright laughs cannot hmm chuckles weren ooh gentlemen darling goodbye kidding marry forgive hasn swear idiot crying bastard screaming mum mama lieutenant boyfriend cops laughter mmm madam grunts colonel owe aunt aah ow gasps yep shh hadn narrator grunting upstairs sergeant ringing hiding applause stole groans mommy ridiculous majesty asleep goddamn sweetheart asshole beg fuckin cheering whoever apologize bullshit grandma shouting murdered cousin pardon lied breathe screams nonsense grandpa honestly bro sweetie whoo papa ugh hurts jealous pretend threw mister indistinct disappeared expecting handsome slept insane cares nope ohh nah",
  "gosh ruined outta sooner goin regret beeping yelling murderer goodness grandfather ruin liar thief bleep knocking groaning madame downstairs scare pity ashamed waited doin useless panting clears clever hm yourselves kicked disgusting jerk freak screwed awake chuckling grandmother heh honour burned smells joking beating disappear chatter scream unbelievable ahh scoffs motherfucker stealing pissed woke borrow escaped warn announcer someday monsieur toast hank hated convince chattering brains blew eaten knees ambulance staring stairs joey trapped rude clue amen lily mustn elevator highness sometime beeps gasping curse bastards blows maggie gunshot hug loser sobbing marty hitler bravo growling exhales knocked beloved nothin robbery hates mummy fellas whispering gee kissed barking maid embarrassing wasting demon coincidence terrific quietly hurting whistle molly subtitles chasing cruel behave bury pathetic approaching jumped firing abby erm guts fella damned couch cheer shy closet coward",
  "siren cheating confess suspicious frightened crossed bullets germans miserable embarrassed terribly kidnapped shout wounded bud messed aboard sweat ghosts deserves dreaming bust surrender crush yup comrade insist selfish skull frankie survived",
].join(" ");



/* 1511 IELTS/academic forms: Academic Word List families (Coxhead), dossier collocation vocabulary, British spellings, proper nouns. */
const IELTS_TOPIC_WORDS = [
  "abandon abandoning abandonment abandons abnormal abnormally abrupt absentee abstraction academia academically academies accidental accommodated accommodating accompanies accompaniment accompany accountant accra accumulate accumulated accumulating accumulation achieves acknowledgement acknowledges acknowledging acl acquiring adapt adaptability adaptable adaptations adapting adequately adjusting admiration adolescents adulthood advocated advocates advocating aeroplane afghan aggregation aggressively ahmed aided aiding aires aisha ajax albeit algiers allegation allocate alteration alterations altering alternating alters ambiguity ambiguous ambitious amends amman analogue analogy analyse analysed analysing analyzing anticipate anticipating anticipation anxious appreciates appreciating apprenticeships approachable approached appropriately approximation aptitude arabian arbitrarily ashford assemble assemblies assembling assigning assistants assisting assurances assuredly assures assuring",
  "athlete attaches attaching attain attained attributed authoritative avoidable bangalore banning bedside beirut belgian belgrade beneficiaries beneficiary benefited benefiting biased blockbuster blown blur bogota bonded bonding boosts borne branding breadth briarwood briefed brownfield bucharest buenos bulky bureaucracy bureaux byproduct cairo caldwell calories capacities carrots casablanca casualty cease ceased ceaseless ceases censorship centrifuge challenger challengers changers charted charting checkpoint chemically chennai childcare circumstance citing clarification clarified clarify clarifying clauses clickbait coastlines coded coexist coherent coincide coincided coincidences coincidental coincides collapsed collapses collapsing collectively collisions collocations colombo comedian commence commenced commencement commences commencing commentator commenting commissioned commits committing communicated communicates communicating commute commuter commuters commuting compensate",
  "compensated compensating compensations competitor compiling complains complementary complexities compounded comprise comprised conceivable conceivably conceive conceived conceiving concentrated concentrating conception concludes concluding conclusive conclusively conducts confer conferred conferring confine confined confines confining confirming confirms conflicted conflicting conform conformity congested congestion conscientious consented consenting considerably consisted constancy constituency constituent constituents constituted constrained constructing constructions constructive consultations consulted consults consume consumed consumes consuming contemporaries contestable contracted contradict contradicted contradicting contradiction contradictions contradictory contradicts contrasts contributes convene convened convening converse conversely converting converts conveyor convinces convincing convincingly cooperate cooperated cooperates cooperating coordinating coordinators",
  "copenhagen cores correspond corresponded correspondents corresponds corrupt counterparts coupling covid craftspeople creatively creators credibility credited creditor creditors crucially cruelties cullet culturally cultured cushion custodians cyberbullying cycled damascus debatable debated debates debating decarbonises decay declines declining decoration deduce deduced deduction deductions defensible defer definite definitive deforestation deliberate democratised demonstrating demonstrations demonstrators denials denies denote denying dependable dependency depress depressed depresses depressing deprived derivative derivatives derive derives desalination destructive detectable detecting detectives detectors detects deterrent deviate deviated devote devoting devotion dhaka diagnosed dialysis differentiate diligence diligently diminish diminished diminishes diminishing dioxide dipped dipping disadvantaged disagreement disagreements disappointment discretionary discriminate discriminated",
  "discriminating dishonest displace displaced displacement disposable dispose disposed disposing disproportionate disruption dissimilar distinctions distinctive distinctly distort distorted distorting distortion distortions distorts distraction distributing diversified diversify documenting doha domesticated dominance dominate dominated dominates dominating domination donating dotted drafted drafting drafts dramas draught dunmore dyslexia eastgate economical economically economist economists edits eliminated eliminates eliminating embed emerge emerged emergence emergent emerges emit emojis emphasise emphasize emphasized emphatic emphatically encoded encountering encounters energetic energies enforce enforced enforcing enhances enormity enormously enrich enrolment ensured enthusiasm entrench entrepreneurship environmentalist environmentalists environmentally epidemics equate equip erode eroded eroding erosion erroneous escalate establishes establishments estimating ethic ethically",
  "ethnicity eventual eventuality evicted evidently evolutionary evolve evolved evolves evolving exceeded exceeding exceeds exhaustion exhibited exhibiting expands expansive expertly explainable exploit exploitation exploited exploiting exploits exported exporting expose exposes exposing externally extinction extracted extracting extracts eyesight fabricated facebook facilitated facilitator fade farmland fatima favouritism fierce filipino filtration finalised finalize finalized financed financially financier financiers fishermen flagship flavour flawed flaws flourish fluctuates fluctuating fluctuation fluctuations fluency folklore followers footprint formalise formulas formulate formulated forthcoming fosters founders founding freelancers freshwater frustrating fuelled fulfil functioned fundamentally genders gesture globalisation globalised globalising globalization globalized globally graded grading grandchildren granddaughter grandparental granting grievance growers guaranteeing",
  "guesthouses habit halt handful hannah hanoi hardback hardship helsinki hesitation highlighting homestays hopeful hostile housework hover humour hypotheses hypothetically ico identifiable identities ideological ideologies ideology idleness ielts ignorance ignorant ignores ignoring illegally illogical illustrate illustrates imagery imaginary imitate immature immediacy immigrant immigrated impacted impairments implements implicate implicated implicates implicating implication implicit implicitly imply implying imposes imposing imposition impoverish imprisonment impurities inability inaccessible inaccurate inadequacy inadequate inappropriately incapable incapacitate incapacitated incidental incidentally inclination inclinations incline inclined incoherent incoherently incomes incompatible inconceivable inconclusive inconsistencies inconsistency inconsistent incorporating indefinite indefinitely indications indicative indiscretion indispensable indistinctly individualism individuality",
  "induce induces inducing inequality inevitability inevitable inevitably infer inference infinitely inflexible ingredient inherent inherently inherit inheritance inherits inhibit inhibited inhibition inhibitions initiate initiates initiating initiation injure injuring innovate innovator innovators insecure insecurities insecurity inserting inserts insightful insignificant inspect inspected inspecting inspectors instability instagram instalment instituted institutionalized instruct instructed instructing instructive instructs insufficient intelligently intensely intensified intensifies intensify intensifying interacted interacting interacts intermediaries internally internships interpret interpretations interpreting intervene intervened intervening intimacy intra intrinsic introductions intrudes intrusive invariably invested investigates investigating investigative invests invisibility invoke invoked invoking iranian irrational irrelevant irreplaceable irreversible isolate isolating",
  "issuing jakarta janeiro johannesburg judgement justifiable justification justified justifies justifying karachi kathmandu kerb kestrelton kilometer kilometre kilometres kolkata kuala labeling labelled labelling labored labors laboured labours lagos lags lahore lawful layered lectured lecturer lecturing legality leila lent lever levers liam liberalism liberate liberated liberating liberation liberator liberators libya licences lifeline lifelong lima linkage lisbon liter litre liveable livelihood locating locational logically loyalty lucrative lumpur malaysian manila manipulate manipulated manipulates manipulating manipulation manipulative manoeuvre marginal marginally margins matured maturing maturity maximise mediate mediation medically melatonin melts mentality mentally meritocratic methodical middleman middlemen migrant migrants migrate migrated migrating migrations migratory minimalist minimise ministerial minorities minors misinterpret misinterpreted mismatch mocked mockery",
  "modernise modifying mohammed motivate motivates motivating motivations motive motives moz multiples mutually nairobi necessities negate negatively negatives neighbour neighbourhoods neutralise neutrality neutralize neutralized newsrooms nigerian nina nonetheless normalise normality norms northfield notions notwithstanding numeracy nutrients objection objections objectively objectivity obliged obstacles occupancy occupant occupants occupies occupy occupying occurrences offence offend omar omitting opec operative opted orient osaka oslo outlast outlay outright outrun outruns outstrip overcrowding overestimate overestimated overlap overlapping overlook overlooks overrun overtake overtaken overtook overused overwhelming padding pandemic paradigm parallels participates paulo pauses peaking pedestrianised penalised perceive perceives percentages perceptions permeable perpetuate persist persisted persistence persistently persists phased phenomena phenomenal philosopher philosophers",
  "philosophical philosophically philosophies photosynthesis pillar plough plummet plummeted plummeting pollute posed poses positively postcode practise precede preceded precedence precedent precedes predictable predicting predicts predominantly preliminaries prerequisites presumably presume presumed presuming presumption presumptuous principally principled prioritise prioritize priya procedural proceeded professionalism professionally profiler prohibit prohibiting prohibition prohibits projecting projections promoter promoters proportional proportions prosper provokes psychologically psychologist psychologists publishes punish punished punishes pursued pursues pursuing pursuits pyongyang quadruple quadrupling quota quotation quoting rad radically radicals raj randomly ranged rationality rationalize rationally react reacted reacting reactionary reactivate reactive reactor reactors reacts readjust reappear reassess reassign reassigned recession recognise reconstruct reconstructed",
  "reconstructing recovering recovers recreate recreated recreating redefine redefined refinement refining refocus reforestation refugee regeneration regimes registering registers regulate regulates regulating regulator regulators reinforce reinforced reinforcement reinforcements reinforcing reinvested rejecting rejection rejects rel relapse relaxed relaxes relaxing releasing reliably reliant relic relied relies relocate relocated relocating reluctance reluctant reluctantly removes reoffending repaid repertoire repetition replayed replicate reschedule rescheduled researched researches researching reside resided resides residing resilience resold resolving resourceful responds responsive restores restoring restrain restrained restraining restraint restraints restricting restrictive restructure retainer retainers retaining retains retractions retrain retraining reuse revealing revelations reversal reversed reverses reversible reversing revise revising revolutionaries revolutionize",
  "revolutionized revolutions rewrite rigid rigidity risers rival rivals riyadh rota rotas rotate routed routinely safeguards salty santiago scarcest scepticism schedulers schematic scheming sectioned securing sedentary selects seoul sequencing sequential sever sex sexes sexism shaken shelves shenzhen shifted shifting shifts shortcut shortened shortlist shortlisting sidebar sift signalled signifies signify signifying similarities similarity simulate simulated simulating smartphones snacks socialised socialising sofia solvable sophie sourced southbank souvenirs spacecraft specialisation specialised specialism specialization speculation spheres spherical spontaneous sprawl stabilise stabilised stabilize stabilized stabilizing stagnant stagnate standby stark statistic statistically stigma stimulates storey storeys straightforward strategically strategist streamline stressed stresses stressful stressing stripped structurally styled styling subordinate subordinates subsidies subsidise",
  "subsidises subsidize subsidy substituted substitutes substituting substitution subtitled succession successive successor successors summarize summation summed summing sums supervise supplementary supportive suppress surged surging surrendered surveyed surveying survives surviving suspend suspending sustain sustaining sustains sustenance swapped symbolic symbolically symbolism symbolize symbolized symbolizes taipei takeaway taped taping targeting teamed teaming technically technologically teenager teenagers tehran tenancies tenancy tense tensions terminate terminated terminating thankyou theoretically theorist theorists theses threaten threatens tiredness tonne tonnes topical traceability traceable traced traces tracing tradesperson traditionally tram transference transferring transformations transformed transforming transforms transitional transitions transmissions transmits transmitting transported transporter transporters transporting transports travellers triggered triggering",
  "triggers tunis twitter tyre ukrainian unacceptable unaccompanied unaffected unaffordable unappreciated unattached unattainable unavoidable unaware unbiased uncharted uncomfortable uncommon unconstitutional uncontrolled unconventional uncoordinated undeniable undeniably underestimate underestimated underestimating undergo undergoes undergoing undergone undermined undermines underpin understandably undertaking undertook underwent undeveloped unequal unethical unevenly unexplained unfamiliar unfold unfounded unheard unicef unification unify unifying uninterrupted uniquely uniqueness unite unjust unjustified unlicensed unparalleled unpopular unprecedented unpredictability unpredictable unpublished unqualified unquestionably unrealistic unreliable unresolved unresponsive unrestrained unrestricted unsafe unscheduled unsettled unstable unsuitable unsupervised unsustainable urbanisation urbanised urbanising urbanization urbanized usefulness utilise utilized utilizing vacancy vaccinate",
  "vaccinated validate validated variant verifiable violate violated violates violating visibly visions visualise visualization visualize visualizing visually voluntarily volunteered volunteering warsaw wei wellbeing whereby willingness willpower wisely worsen worthless worthwhile woven wrapper yangon youtube yuki zagreb zurich",
].join(" ");



/* 1953 words lifted from the read-only bank (seed ideas, chart labels, stage/area names, model answers) so bank vocabulary never reads as a typo. */
const BANK_TOPIC_WORDS = [
  "abilities about above absent absolute absorb absorbed abuse academic accelerate accelerated acceptable access accidents accommodation account accounted accounting accounts achieved achievement acknowledged acknowledgement across act action active activities activity adaptable add added addiction adding addressed adjusted administration admire admittedly adult adults advantages advertised advertising advice affect afford affordable aforementioned africa after again against age aged agree agreeing agreement agreements agricultural agriculture aid aimed air algorithms all allowed almost alone alongside already also although ambition among amount amounts an ancient and announce answer answered answers any anywhere apartments appeal appeals appear appeared applicants applications apps are area areas argue argument arguments around arrivals art artificial artists as ash ashford asia asian ask asked asks assessment at ate attention attract attracted audience audited australian automated",
  "automation autonomy availability available average avoid away back background bad balanced band banks bar barely based basic batteries be beach became because become bed been before begin beginning begins behind believe belongs below belt benefits beside best between bias bicycle biggest bikes bilingual binding block blowing boats bodies body books borders both bottle bottled bottles bottling bought boundary branch branches brazil bread bridge brief briefly brightness brine bring brings british broad broadcast broadcasters broaden brown budget budgets build building buildings builds built burnout bus buses busier busiest business businesses busy but buy buyers buying by bypass byproduct caldwell campaigns campus can canada candidates canning cannot canteens caps car care career careers carers carried carries carry case cash categories category cause causes cc ceiling central centre centrifuge centuries chances change changed changes changing charge charging chart charts cheap cheaper",
  "check checked chemical childcare children china choice choices choose choosing chosen chronic church circulates cities citizens city civic clash clean cleaned clear clearest clearly clicks clients climate climbing clinics close closing clothing clubs cluster coal coarse coastal coin coincided collected collection collections colour column combine combined come comes commercial commit committing common commonly communicating communication communities community commute commuters commuting company compare compared compares comparing comparison compass compete competence completed composition comprehension compulsory computer concentrated concession conclusion conditional congestion connection connections conservation considerably consistency consistent consistently constant construction consume consumed consumer consumers consumption contact contacts containers continue continuous contrast contrasts control controversial convenient converted conveyor cook cooking cool copy core correct",
  "corruption cost could countries country counts courtyards cover coverage covered covering covers crafts create creates creative crime crimes criminal critically crops cross crossed crossing crossings crossover crowded crowds crushed crusher crushing crux cullet culture cup curriculum customers cut cutting cycle cycling cyclists daily dairy damage damages data dates dawn day debris debt decide decides decision decisive decline declined declining decrease dedication degree delivered delivery demand denied denmark dense depend dependent depth descending described describes deserves despite destination destinations develop developed development device diagram did diet dietary diets differed different diffuse digital digitally dip direct direction directions directly disadvantages disagree disappeared disappearing disconnect discourage discovering discuss discussed discussion disease dislike dismiss dismissed display disrupted distances distribution district districts disturb do dock does",
  "dollars domestic dominance dominant dominate done donors dossier doubled down downturns drawbacks drawn drink drinking drivers drives driving dropping during duties each earlier early easier east eastern easy eaten economies edging editor editors education effect effects effort eggs eight eighteen either elderly elections electric electricity electronics emergency emissions emotional emotionally empathy employees employer employers employment empty end ended ending ends energy enforceable engineering enlarged enough enrolled enrolment enter entered entertainment entrance environment equal equally equipment era erase errors escape essay estate europe european euros evaluation even event events eventually every exactly exam example exceeds exchange exclusion exercise exhibitions existed existing expand expanded expansion expectation expectations expected expenditure expense experience explained explaining explains explicit explicitly exploration exporting expose express expression",
  "extended extends extent extraction eyes eyewitness face facilities factor factory facts fail fairer fairness fall falling falls false fame families family famous far farmers farmland farms fast faster fastest fault favour features fee feel fees fell fence festivals few fewer field fields figure figures files filled filling filter filtered filters final financial find finding finished finishing first fish fishermen fishing fit fits five fixed flexible fluctuated fluctuating flying focus following follows food foods football footbridge footpath for forcing forecasting foreign former forms forth fossil found four fourteen fragile fragment france free freedom french fresh fresher freshness freshwater friendships from fruit fry fuels full fully functions fund funded funding furnace furniture further future gain galleries games gangs gap gaps garden gas gate gatekeepers gender general generated generation german germany get gifts give gives giving glass global good goods government",
  "governments gradual graduate graduates grandchildren grandparents graph grass grassland gravel grazing greatly green grew grounds group grouping groups grow growing grown grows growth guaranteeing guides guiding gymnasium habits had half hall halls handled handles happened happening harbour hard harden harm harvested harvesting has hatch hatched hatching have health healthier healthiest healthy heat heavily held help helped heritage hidden high higher highest highlights highly hiring historic history hits hold holiday holidays home homelessness homes horizons hospitals host hosting hotel hotels hours household households housing how human humanities hydro identical identified if ignore ignores ill illness illnesses illustration images imf immediate immediately impartial impartially implication implied important impression improve improved improves in inaction including income incomes increase increased increases increasing independent india indicates individual individuals industrial",
  "industries industry influencers infrastructure innovation innovative inside insights instability instant instantly instead institution instruction insurance intake intelligence interests international internet interrupt interruption interruptions intervention interview interviews into intro introduction invaluable invested investors invited irregular is issue it italy its japan japanese jars job jobs journalists journeys judged judgement just justify keep keeps kept keyword kg kilograms know knowledge label laid lake land landlords landscapes language languages large larger largest last late later lawns layout lead leads learners learning least leave leaves leaving left leisure less lets letting level levels library lie life lifestyle lift light lighter likely limited limits line linear lines link linked linking links listing lists literacy little live loans local locally location locations long longer lorries lose loss lost low lower lowers lowest luck machinery machines made main",
  "mainly major majority make makes making malaxer manageable many map maps marina marine maritime market marketed markets marks marriage match matters may meals mean measurable measure measured measurements measures meat mechanical mechanisms media medicine meeting melted melting membranes mental mentoring messages messaging metal migration mill million millions mineral minerals minority minutes mislead misread missing misunderstandings mix mixed mixing mode modern modes modest modestly molten money monitored month monthly months more most moulded moulds move moved moving much multiplies museum museums must my named narrow narrowing national nations natural naturally navigation near nearby need needed needs negative neglect neglected neglects negotiate negotiating neighbourhood neighbourhoods neighbours nepal nests nets network neutral never new news newspapers next nigeria night nine no none normal north northern northwards not notifications noting now nowadays nuclear number numbers",
  "numerical nutrition nutshell obsolete obvious ocean of offenders offer office official often oil old older oldest olive olives olympic on once one online only open opened openly openness operators opinion opportunities opposing opposite optical options or oral orchard order ordinary origin osmosis other others otherwise out outdated outlets outside outsiders outspent outweigh over overall oversight overtaking overtime overtook own owner ownership paid paired paper paragraph paragraphs parents parish park parking parks part partial partially participants parts pass passed passive past paste patience patients pattern patterns pay paying peaking pedestrian peer penalty pension pensions people per percentage percentages perfect perform performances performers performing period permanence permanent permission persistence person personal phase phones phrases physical pick pie pieces piped pipes pitch pitches place planned planning plant plastic platforms play playing pleasure plus point",
  "points poland policies politically pollution poor poorer popular popularity population populations populous portability position positive possible poverty practical practice pre prejudice prejudices preparation present presents pressure prevent preventable preventing prevention preview previews price prices pride primary print printed priority prison prisoners privacy problem problems process processing produce produced producers produces product production professional profile profits programmes progress projected projects promotion prompt properly property proportion proportional proposals propose prospects protect protection proven proverbs provide provided provides public publication publicly publishers pumps pupil pupils purchases purchasing push pushes put quality quay question questions quickly quieter quietly quotes radio range ranking rapid rarely rate rates rather reach reaching read reader readers reading ready real reality reason reasons rebuilt recent recognition",
  "recommendation record recorded recovered recovery recreate recruited recruiter recruiters recruitment recycle recycled recycles recycling redeveloped redevelopment reduce reduced reduces reference regardless regeneration region regions regular regulated regulation rejected rejection relative relatives release released releases relevance reliable relief relieve relocating remain remained remaining remains remember remote remove removed renewable rent rents repairs repeat repeatedly repeats replace replaced report reported reputation requested required research resentment residential residents respect response responsible rest restate restaurants restrict results retailer retailers retirement return revenue reverse rich rigid ripe rise risen rising risk river riverside road roads roof room rose route routes routines row rules run runs salary sale salmon salt same sand satellites saw scale scarce scattered school schooling schools science sciences scientific scores screen screened",
  "screening screens scrutiny sea seafood search season seasonal seawater second secondary sector sectors see select send sensible sensors sent sentences separate separated separates separation sequence services sessions set sets seven seventeen several shakers shall shallow shape share shared shares sharp sharply shed shifting shoppers shopping shops short shortage shorter should show showed showing shown shows shrank shrinking shy sick side sides sign significant similar similarity simple simply since single site sites sitting situation six sixteen size skeleton skill skilled skills skim sleep slice slices slight slightly slipped slow slowly small smaller smallest smolts so social soda software solar solid solutions solve solved some someone sometimes somewhere songs sorted sorting source sources south southern space spaces spain spaniards spawn spawning speakers speaking specialise speculative speed spend spending spent spill sport sporting sports spread stability stable stadiums staff",
  "stage staged stages stance stand start started starters starting state stated status stay stayed stays steadily steady steep still stone stop storage stored stories story street streets strengths stress stretched strict strong stronger strongest structure struggling student students studies study studying subject subjects success such sugary suggested suit suitable sums supermarket supermarkets supplied supply support supported supporting supports surface surveyed survive sweden swedish swim system table tablets take taken talented tanks targets task tasks tax taxpayers teach teaches teaching teams technologies technology teenagers television temporary ten terms tested text than that the their them themselves then there thesis they think third thirds this those though thousand thousands three through throughout time times timetable tire titles to today together tone too took topic total totals tour tourism tourist town toys tr trade tradition traditional traditions traffic train",
  "training transferable transfers transformation transport transported travel travelling trawlers treating treatment trees trend triggers tripled true trusting trustworthy turn twice two type types uk unbalanced uncapped unchanged under understanding unemployed unemployment unfair unfairly unfinished unhappy unhealthy union unit units universities university unlike unlimited unnoticed unpaid unquantified unsuited until untouched unused unverified unwell up upgraded upkeep upstream upward urban urgent us usa use used user using usually vaccination valuable value values vanish vanished vegetable vegetables vehicles vending venues verdict versus very vietnam view viewers views village virgin visible visit visited visitor visitors visits vocabulary voice wages wait waiting walk walking warehouses warmed warning was washed washing waste wastes wasting watching water way weak weaken weaker weakest weakly wealth wealthy weather websites week weigh weighing weighs weighting well were west",
  "western what whatever when where whereas whether which while who whole whose why widen widening widest will wind winner wins with within without woodland word wording words work workers working workload works world worst would writing written wrong yachts year years yes yet you young youngest your youth zone",
].join(" ");

/**
 * Embedded word lists so the spelling detector works with no network and no
 * extra dependency. Sources:
 *  - the ~10k most common written-English words (Google Trillion Word Corpus
 *    frequency list, swear-free cut);
 *  - the most frequent spoken-English words (FrequencyWords/OpenSubtitles, MIT);
 *  - Academic Word List headwords and family forms (Coxhead, 570 families);
 *  - IELTS collocation vocabulary from the dossier (§8.2) plus British spellings;
 *  - vocabulary lifted from the read-only bank (seed ideas, chart labels, stage
 *    and area names, model answers) so bank wording never reads as a typo.
 *
 * The known misspellings curated in `grading/lexical.ts` are deliberately absent
 * (`recieve`, `goverment`, `enviroment`, …) so the detector still fires on them.
 */

/** IELTS topic words that only survive as one-off dictionary entries. */
const EXTRA_TOPIC_WORDS =
  "affirmative antibiotic antibiotics apprentice apprenticeship assimilate assimilation austerity authoritarian bailout carpool colonisation compost concur coworker coworking cycleway decarbonisation decarbonization decolonisation deflation delegates deport deprivation deterrence devastating digitalisation digitalization drought electrification embargo emigration entice epidemic eruption extinct extracurricular fertiliser fertilisers fertilizers gentrification herbicides immunisation immunization incarceration incinerate incineration industrialisation layoff industrialised insecticides legislate linker malnourished malnutrition meritocracy micronutrient mindfulness mortgagee nationalisation naturalisation particulates pesticide pesticides photovoltaic poaching precarious privatisation privatization propaganda racism racist redundancy refinery renovating residency reskill robotisation sanctions spite stagnation stimulus subway telecommute teleworking turbine typhoon upskill volcano watchdog";

/** Irregular forms the suffix rules cannot derive (`blown`, `shaken`, …). */
const IRREGULAR_FORMS =
  "awoken been born broke broken brought built bought caught chose chosen done drew drawn drank driven drove eaten fallen fell felt flew flown forgot forgotten found gave given gone grew grown had has held hid hidden hit hurt kept knew known laid led left lent let lost made meant met paid put ran read ridden risen rode said saw seen sent set shaken shone shook shown shut sang sung sank sat slept sold sent spent spoke spoken stood stuck struck swore sworn swam taken taught tore torn threw thrown told took understood woke worn went were won wore written wrote";

export interface SpellingDictionary {
  /** Base words plus generated inflections, in commonness order. */
  words: readonly string[];
  /** word → commonness score (lower = more common); generated forms carry base + 0.5. */
  rank: ReadonlyMap<string, number>;
  /** Length → candidate words, used by the suggestion search. */
  byLength: ReadonlyMap<number, readonly string[]>;
}

let cachedSpellingDictionary: SpellingDictionary | null = null;

const SPELLING_VOWELS = "aeiou";

/** Adds the regular inflections a token may take (`-s`, `-ies`, `-ed`, `-ing`, …). */
function addInflections(word: string, add: (form: string) => void): void {
  const n = word.length;
  if (n < 3) return;
  const last = word[n - 1];
  const isVowel = (char: string) => SPELLING_VOWELS.includes(char);

  add(`${word}s`);
  if (/(?:s|x|z|ch|sh)$/.test(word)) add(`${word}es`);
  if (last === "y" && !isVowel(word[n - 2])) {
    const stem = word.slice(0, -1);
    add(`${stem}ies`);
    add(`${stem}ied`);
    add(`${stem}ier`);
    add(`${stem}iest`);
    add(`${stem}ily`);
  }

  const cvc =
    n >= 3 && !isVowel(word[n - 3]) && isVowel(word[n - 2]) && !isVowel(last) && !"wxy".includes(last);
  if (cvc) {
    // stop → stopped/stopping, big → bigger (never `stoped`/`biger`).
    const doubled = word + last;
    add(`${doubled}ed`);
    add(`${doubled}ing`);
    add(`${doubled}er`);
    add(`${doubled}est`);
  } else if (last === "e") {
    // create → created/creating, large → largely.
    add(`${word}d`);
    add(`${word.slice(0, -1)}ing`);
    add(`${word}r`);
    add(`${word}ly`);
  } else {
    add(`${word}ed`);
    add(`${word}ing`);
    add(`${word}er`);
    add(`${word}est`);
    add(`${word}ly`);
  }

  // Productive derivations IELTS essays lean on (apprentice → apprenticeship,
  // mentor → mentorship, inclusive → inclusivity, prevent → preventative, …).
  add(`${word}ship`);
  add(`${word}ism`);
  add(`${word}ist`);
  add(`${word}ness`);
  add(`${word}ful`);
  add(`${word}less`);
  add(`${word}ance`);
  add(`${word}ence`);
  add(`${word}able`);
  add(`${word}ation`);
  add(`${word}ity`);
  add(`${word}ative`);
  add(`${word}ous`);
  add(`${word}al`);
  if (last === "y" && !isVowel(word[n - 2])) add(`${word.slice(0, -1)}iness`);
  if (last === "e") {
    const stem = word.slice(0, -1);
    add(`${stem}ation`);
    add(`${stem}ity`);
    add(`${stem}ative`);
    add(`${stem}ous`);
    add(`${stem}able`);
    add(`${stem}al`);
  }
}

/**
 * Builds and caches the offline dictionary. ~13.6k base words expand to ~80k
 * entries with inflections; the whole payload stays under 200 kB and is never
 * fetched at runtime.
 */
export function spellingDictionary(): SpellingDictionary {
  if (cachedSpellingDictionary) return cachedSpellingDictionary;

  const words: string[] = [];
  const rank = new Map<string, number>();

  const addBase = (word: string) => {
    if (word.length < 2 || rank.has(word)) return;
    rank.set(word, words.length);
    words.push(word);
  };

  const combined = `${COMMON_ENGLISH_WORDS} ${IELTS_TOPIC_WORDS} ${BANK_TOPIC_WORDS} ${EXTRA_TOPIC_WORDS} ${IRREGULAR_FORMS}`;
  for (const word of combined.split(" ")) {
    addBase(word);
  }

  const baseCount = words.length;
  for (let i = 0; i < baseCount; i += 1) {
    addInflections(words[i], (form) => {
      if (form.length < 3 || rank.has(form)) return;
      rank.set(form, i + 0.5);
      words.push(form);
    });
  }

  const byLength = new Map<number, string[]>();
  for (const word of words) {
    const bucket = byLength.get(word.length);
    if (bucket) bucket.push(word);
    else byLength.set(word.length, [word]);
  }

  cachedSpellingDictionary = { words, rank, byLength };
  return cachedSpellingDictionary;
}

/** Total known forms (base + inflections) — diagnostics and unit tests. */
export function spellingDictionarySize(): number {
  return spellingDictionary().words.length;
}
