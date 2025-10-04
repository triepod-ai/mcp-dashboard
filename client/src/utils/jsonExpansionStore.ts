/**
 * Global JSON expansion state manager
 * Persists expansion state outside of React component lifecycle
 */

class JsonExpansionStore {
  private expansionStates = new Map<string, Record<string, boolean>>();
  private viewModes = new Map<string, string>();

  /**
   * Get expansion state for a specific JSON view instance
   */
  getExpansionState(instanceId: string): Record<string, boolean> {
    return this.expansionStates.get(instanceId) || {};
  }

  /**
   * Set expansion state for a specific node path in a JSON view instance
   */
  setNodeExpansion(
    instanceId: string,
    nodePath: string,
    expanded: boolean,
  ): void {
    const currentState = this.getExpansionState(instanceId);
    const newState = {
      ...currentState,
      [nodePath]: expanded,
    };
    this.expansionStates.set(instanceId, newState);

    console.log(
      `[JsonExpansionStore] Set ${instanceId}/${nodePath} = ${expanded}`,
      newState,
    );
  }

  /**
   * Toggle expansion state for a specific node path
   */
  toggleNodeExpansion(
    instanceId: string,
    nodePath: string,
    defaultExpanded: boolean = false,
  ): boolean {
    const currentState = this.getExpansionState(instanceId);
    const currentlyExpanded = currentState[nodePath] ?? defaultExpanded;
    const newExpanded = !currentlyExpanded;

    this.setNodeExpansion(instanceId, nodePath, newExpanded);
    return newExpanded;
  }

  /**
   * Clear all expansion states for cleanup
   */
  clearAll(): void {
    this.expansionStates.clear();
    this.viewModes.clear();
  }

  /**
   * Clear expansion state for a specific instance
   */
  clearInstance(instanceId: string): void {
    this.expansionStates.delete(instanceId);
    this.viewModes.delete(instanceId);
  }

  /**
   * Get view mode for a specific JSON view instance
   */
  getViewMode(instanceId: string, defaultMode: string = "raw"): string {
    return this.viewModes.get(instanceId) || defaultMode;
  }

  /**
   * Set view mode for a specific JSON view instance
   */
  setViewMode(instanceId: string, viewMode: string): void {
    this.viewModes.set(instanceId, viewMode);
    console.log(
      `[JsonExpansionStore] Set ${instanceId} viewMode = ${viewMode}`,
    );
  }
}

// Global singleton instance
export const jsonExpansionStore = new JsonExpansionStore();
