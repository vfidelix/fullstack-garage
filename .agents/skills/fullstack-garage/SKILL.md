```markdown
# fullstack-garage Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill provides guidance on the development patterns and conventions used in the `fullstack-garage` TypeScript codebase. It covers file naming, import/export styles, and testing patterns, ensuring consistency and maintainability across the project. While no specific frameworks or automated workflows were detected, this guide documents the project's established best practices and offers suggested commands for common development tasks.

## Coding Conventions

### File Naming
- **Style:** kebab-case
- **Example:**  
  ```
  user-service.ts
  api-handler.test.ts
  ```

### Import Style
- **Relative imports** are used throughout the codebase.
- **Example:**
  ```typescript
  import { getUser } from './user-service';
  ```

### Export Style
- **Named exports** are preferred.
- **Example:**
  ```typescript
  // user-service.ts
  export function getUser(id: string) { ... }
  export const USER_ROLE = 'admin';
  ```

### Commit Messages
- **Freeform style** with no strict prefixes.
- **Average length:** ~27 characters.
- **Example:**
  ```
  fix bug in user fetch
  add login endpoint
  update readme
  ```

## Workflows

_No automated workflows detected in the repository._  
Below are suggested manual workflows for common development tasks.

### Run Tests
**Trigger:** When you want to verify code changes.
**Command:** `/run-tests`

1. Identify all test files matching the `*.test.*` pattern.
2. Use your preferred test runner (e.g., `ts-node`, `jest`, or `mocha`) to execute tests.
3. Review test output and address any failures.

### Add a New Module
**Trigger:** When implementing a new feature or service.
**Command:** `/add-module`

1. Create a new TypeScript file in kebab-case (e.g., `feature-name.ts`).
2. Use relative imports to include dependencies.
3. Export functions or constants using named exports.
4. Write corresponding test files with the `.test.ts` suffix.

### Refactor Existing Code
**Trigger:** When improving or restructuring code.
**Command:** `/refactor`

1. Update file names to kebab-case if needed.
2. Ensure all imports are relative.
3. Convert default exports to named exports.
4. Update or add tests as necessary.

## Testing Patterns

- **Test files** are named using the pattern `*.test.*` (e.g., `user-service.test.ts`).
- **Testing framework** is not specified; use your preferred TypeScript-compatible test runner.
- **Example test file:**
  ```typescript
  // user-service.test.ts
  import { getUser } from './user-service';

  describe('getUser', () => {
    it('returns user by id', () => {
      const user = getUser('123');
      expect(user.id).toBe('123');
    });
  });
  ```

## Commands

| Command      | Purpose                                 |
|--------------|-----------------------------------------|
| /run-tests   | Run all test files in the codebase      |
| /add-module  | Scaffold a new module with tests        |
| /refactor    | Refactor code to match conventions      |
```
