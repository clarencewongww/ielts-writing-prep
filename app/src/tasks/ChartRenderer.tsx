/**
 * ChartRenderer — single entry point for drawing any Task 1 item.
 *
 * Dispatches `type` to the specialised view through `ChildTaskView` and wraps the result
 * in an error boundary: if a view throws for malformed or unexpected data, the item is
 * rendered as a plain FallbackTable instead, so every item in the bank stays readable.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { FallbackTable } from './FallbackTable';
import { ChildTaskView, type ChildTaskViewProps } from './MixedView';
import type { Task1Item } from './types';

export interface ChartRendererProps extends ChildTaskViewProps {
  /** Force the fallback table (useful in tests or when a view is known to be unsupported). */
  forceFallback?: boolean;
  /** Message shown with the fallback table when an error was caught. */
  fallbackNote?: string;
}

interface BoundaryProps {
  item: Task1Item;
  resetKey: string;
  children: ReactNode;
}

interface BoundaryState {
  error: Error | null;
}

class ChartErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Keep the error visible in the console for debugging; the UI already degraded to a table.
    // eslint-disable-next-line no-console
    console.error(`[ChartRenderer] ${this.props.item.specId} failed to render`, error, info.componentStack);
  }

  componentDidUpdate(previous: BoundaryProps): void {
    if (previous.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <FallbackTable
          item={this.props.item}
          reason={`the ${this.props.item.type ?? 'unknown'} view failed: ${this.state.error.message}`}
        />
      );
    }
    return this.props.children;
  }
}

export function ChartRenderer({ item, title, className, depth, forceFallback, fallbackNote }: ChartRendererProps) {
  if (!item || typeof item !== 'object' || !item.specId) {
    return <FallbackTable item={{ specId: 'unknown-item' }} reason="the item is missing a specId" />;
  }

  if (forceFallback) {
    return <FallbackTable item={item} reason={fallbackNote ?? 'fallback forced by the caller'} className={className} />;
  }

  return (
    <ChartErrorBoundary item={item} resetKey={`${item.specId}:${item.type ?? ''}`}>
      <ChildTaskView item={item} title={title} className={className} depth={depth} />
    </ChartErrorBoundary>
  );
}

export default ChartRenderer;
