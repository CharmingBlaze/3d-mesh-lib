/**
 * Interface for commands that can be executed and undone, forming the basis of an undo/redo system.
 */
export interface ICommand {
  /**
   * Executes the command logic.
   * This method should perform the action and store any state necessary for undoing.
   */
  execute(): void;

  /**
   * Undoes the command logic.
   * This method should revert the changes made by the `execute` method.
   */
  undo(): void;

  /**
   * An optional human-readable description of the command.
   * Useful for displaying in UI elements like history lists or tooltips.
   * e.g., "Add Vertex", "Delete Face", "Translate Selection".
   */
  description?: string;
}
