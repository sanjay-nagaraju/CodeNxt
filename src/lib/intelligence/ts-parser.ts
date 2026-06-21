import { Project, SourceFile, SyntaxKind, Node } from "ts-morph";
import path from "path";

export interface ParsedSymbol {
  name: string;
  type: "COMPONENT" | "FUNCTION" | "CLASS" | "HOOK" | "CONTEXT" | "TYPE" | "INTERFACE" | "ENUM" | "VARIABLE";
  path: string;
  line: number;
  exportType: "named" | "default" | "none";
  signature?: string;
}

export interface ParsedImport {
  source: string;
  specifiers: string[];
  filePath: string;
}

export function createTsMorphProject(projectPath: string): Project {
  const tsConfigPath = path.join(projectPath, "tsconfig.json");

  try {
    return new Project({
      tsConfigFilePath: tsConfigPath,
      skipAddingFilesFromTsConfig: true,
    });
  } catch {
    // Fallback if no tsconfig
    return new Project({
      compilerOptions: {
        target: 99, // ESNext
        module: 99, // ESNext
        jsx: 4, // ReactJSX
        allowJs: true,
      },
    });
  }
}

export function parseFile(
  project: Project,
  filePath: string,
  projectPath: string
): { symbols: ParsedSymbol[]; imports: ParsedImport[] } {
  const relativePath = path.relative(projectPath, filePath);
  let sourceFile: SourceFile;

  try {
    sourceFile = project.addSourceFileAtPath(filePath);
  } catch {
    return { symbols: [], imports: [] };
  }

  const symbols: ParsedSymbol[] = [];
  const imports: ParsedImport[] = [];

  // Extract imports
  for (const imp of sourceFile.getImportDeclarations()) {
    const moduleSpecifier = imp.getModuleSpecifierValue();
    const specifiers: string[] = [];

    const defaultImport = imp.getDefaultImport();
    if (defaultImport) {
      specifiers.push(defaultImport.getText());
    }

    for (const named of imp.getNamedImports()) {
      specifiers.push(named.getName());
    }

    imports.push({
      source: moduleSpecifier,
      specifiers,
      filePath: relativePath,
    });
  }

  // Extract functions
  for (const func of sourceFile.getFunctions()) {
    const name = func.getName();
    if (!name) continue;

    const isExported = func.isExported();
    const isDefault = func.isDefaultExport();
    const isHook = name.startsWith("use") && name[3] === name[3]?.toUpperCase();
    const isComponent =
      name[0] === name[0]?.toUpperCase() && hasJSXReturn(func);

    symbols.push({
      name,
      type: isHook ? "HOOK" : isComponent ? "COMPONENT" : "FUNCTION",
      path: relativePath,
      line: func.getStartLineNumber(),
      exportType: isDefault ? "default" : isExported ? "named" : "none",
      signature: getFunctionSignature(func),
    });
  }

  // Extract classes
  for (const cls of sourceFile.getClasses()) {
    const name = cls.getName();
    if (!name) continue;

    symbols.push({
      name,
      type: "CLASS",
      path: relativePath,
      line: cls.getStartLineNumber(),
      exportType: cls.isDefaultExport()
        ? "default"
        : cls.isExported()
        ? "named"
        : "none",
    });
  }

  // Extract interfaces
  for (const iface of sourceFile.getInterfaces()) {
    symbols.push({
      name: iface.getName(),
      type: "INTERFACE",
      path: relativePath,
      line: iface.getStartLineNumber(),
      exportType: iface.isExported() ? "named" : "none",
    });
  }

  // Extract type aliases
  for (const typeAlias of sourceFile.getTypeAliases()) {
    symbols.push({
      name: typeAlias.getName(),
      type: "TYPE",
      path: relativePath,
      line: typeAlias.getStartLineNumber(),
      exportType: typeAlias.isExported() ? "named" : "none",
    });
  }

  // Extract enums
  for (const enumDecl of sourceFile.getEnums()) {
    symbols.push({
      name: enumDecl.getName(),
      type: "ENUM",
      path: relativePath,
      line: enumDecl.getStartLineNumber(),
      exportType: enumDecl.isExported() ? "named" : "none",
    });
  }

  // Extract arrow function components/hooks (const X = () => ...)
  for (const varStmt of sourceFile.getVariableStatements()) {
    const isExported = varStmt.isExported();

    for (const decl of varStmt.getDeclarations()) {
      const name = decl.getName();
      const initializer = decl.getInitializer();

      if (!initializer) continue;

      const isArrowFunction =
        Node.isArrowFunction(initializer) ||
        Node.isCallExpression(initializer); // for React.memo, forwardRef, etc.

      if (!isArrowFunction) continue;

      const isHook = name.startsWith("use") && name.length > 3 && name[3] === name[3]?.toUpperCase();
      const isComponent = name[0] === name[0]?.toUpperCase() && !name.startsWith("use");

      if (isHook || isComponent) {
        symbols.push({
          name,
          type: isHook ? "HOOK" : "COMPONENT",
          path: relativePath,
          line: decl.getStartLineNumber(),
          exportType: isExported ? "named" : "none",
        });
      }
    }
  }

  // Clean up to free memory
  try {
    project.removeSourceFile(sourceFile);
  } catch {
    // ignore
  }

  return { symbols, imports };
}

function hasJSXReturn(node: Node): boolean {
  const text = node.getText();
  return (
    text.includes("return") &&
    (text.includes("<") || text.includes("jsx") || text.includes("createElement"))
  );
}

function getFunctionSignature(func: Node & { getParameters?: () => Node[]; getReturnType?: () => { getText: () => string } }): string {
  try {
    if (func.getKind() === SyntaxKind.FunctionDeclaration) {
      const declaration = func as unknown as {
        getName: () => string | undefined;
        getParameters: () => Array<{ getText: () => string }>;
        getReturnType: () => { getText: () => string };
      };
      const name = declaration.getName() || "anonymous";
      const params = declaration
        .getParameters()
        .map((p) => p.getText())
        .join(", ");
      return `function ${name}(${params})`;
    }
  } catch {
    // ignore
  }
  return "";
}
