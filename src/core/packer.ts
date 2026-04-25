import { extname, join } from "node:path";
import ts from "typescript";
import { configError } from "../utils/exit.ts";

export type PackSliceResult = {
  files: string[];
  content: string;
};

export type PackSliceOptions = {
  compress?: boolean;
};

const collectMatches = async (
  cwd: string,
  include: string[],
  ignoredPaths: string[],
): Promise<string[]> => {
  const ignored = new Set(ignoredPaths);
  const out = new Set<string>();
  for (const pattern of include) {
    const glob = new Bun.Glob(pattern);
    for await (const rel of glob.scan({ cwd, onlyFiles: true, dot: false })) {
      if (!ignored.has(rel)) out.add(rel);
    }
  }
  return [...out].sort();
};

const languageFromPath = (path: string): string => {
  const ext = extname(path).slice(1);
  if (!ext) return "text";
  if (ext === "md") return "markdown";
  if (ext === "js" || ext === "jsx") return "javascript";
  if (ext === "ts" || ext === "tsx") return "typescript";
  if (ext === "json" || ext === "jsonc") return "json";
  if (ext === "yml" || ext === "yaml") return "yaml";
  return ext;
};

const isJavaScriptLike = (path: string): boolean =>
  [".js", ".jsx", ".ts", ".tsx"].includes(extname(path));

const scriptKindFromPath = (path: string): ts.ScriptKind => {
  const ext = extname(path);
  if (ext === ".tsx") return ts.ScriptKind.TSX;
  if (ext === ".jsx") return ts.ScriptKind.JSX;
  if (ext === ".js") return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
};

const modifiersOf = (source: ts.SourceFile, node: ts.Node): string => {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return modifiers?.map((modifier) => modifier.getText(source)).join(" ") ?? "";
};

const withModifiers = (modifiers: string, text: string): string =>
  modifiers ? `${modifiers} ${text}` : text;

const parameterList = (source: ts.SourceFile, parameters: ts.NodeArray<ts.ParameterDeclaration>): string =>
  parameters.map((param) => param.getText(source)).join(", ");

const typeParametersOf = (
  source: ts.SourceFile,
  typeParameters: ts.NodeArray<ts.TypeParameterDeclaration> | undefined,
): string => typeParameters ? `<${typeParameters.map((item) => item.getText(source)).join(", ")}>` : "";

const renderMethodSignature = (
  source: ts.SourceFile,
  node: ts.MethodDeclaration | ts.MethodSignature,
): string | undefined => {
  if (!node.name) return undefined;
  const modifiers = modifiersOf(source, node);
  const typeParameters = typeParametersOf(source, node.typeParameters);
  const returnType = node.type ? `: ${node.type.getText(source)}` : "";
  return withModifiers(
    modifiers,
    `${node.name.getText(source)}${typeParameters}(${parameterList(source, node.parameters)})${returnType};`,
  );
};

const renderFunctionDeclarationSignature = (source: ts.SourceFile, node: ts.FunctionDeclaration): string | undefined => {
  if (!node.name) return undefined;
  const modifiers = modifiersOf(source, node);
  const typeParameters = typeParametersOf(source, node.typeParameters);
  const returnType = node.type ? `: ${node.type.getText(source)}` : "";
  return withModifiers(
    modifiers,
    `function ${node.name.getText(source)}${typeParameters}(${parameterList(source, node.parameters)})${returnType};`,
  );
};

const renderClassSignature = (source: ts.SourceFile, node: ts.ClassDeclaration): string | undefined => {
  if (!node.name) return undefined;
  const modifiers = modifiersOf(source, node);
  const typeParameters = typeParametersOf(source, node.typeParameters);
  const heritage = node.heritageClauses?.map((clause) => clause.getText(source)).join(" ") ?? "";
  const header = withModifiers(
    modifiers,
    `class ${node.name.getText(source)}${typeParameters}${heritage ? ` ${heritage}` : ""}`,
  );
  const members = node.members
    .map((member) => {
      if (ts.isConstructorDeclaration(member)) {
        return `  ${withModifiers(modifiersOf(source, member), `constructor(${parameterList(source, member.parameters)});`)}`;
      }
      if (ts.isMethodDeclaration(member)) {
        const signature = renderMethodSignature(source, member);
        return signature ? `  ${signature}` : undefined;
      }
      if (ts.isPropertyDeclaration(member) && member.name) {
        const optional = member.questionToken ? "?" : "";
        const type = member.type ? `: ${member.type.getText(source)}` : "";
        return `  ${withModifiers(modifiersOf(source, member), `${member.name.getText(source)}${optional}${type};`)}`;
      }
      if (ts.isGetAccessorDeclaration(member) || ts.isSetAccessorDeclaration(member)) {
        const type = ts.isGetAccessorDeclaration(member) && member.type ? `: ${member.type.getText(source)}` : "";
        return `  ${withModifiers(
          modifiersOf(source, member),
          `${ts.isGetAccessorDeclaration(member) ? "get" : "set"} ${member.name.getText(source)}(${parameterList(source, member.parameters)})${type};`,
        )}`;
      }
      return undefined;
    })
    .filter((line): line is string => line !== undefined);
  return `${header} {\n${members.join("\n")}\n}`;
};

const declarationListKind = (flags: ts.NodeFlags): "const" | "let" | "var" => {
  if ((flags & ts.NodeFlags.Const) !== 0) return "const";
  if ((flags & ts.NodeFlags.Let) !== 0) return "let";
  return "var";
};

const renderVariableStatement = (source: ts.SourceFile, node: ts.VariableStatement): string[] => {
  const modifiers = modifiersOf(source, node);
  const kind = declarationListKind(node.declarationList.flags);
  return node.declarationList.declarations.map((declaration) => {
    const name = declaration.name.getText(source);
    const type = declaration.type ? `: ${declaration.type.getText(source)}` : "";
    const initializer = declaration.initializer;
    if (initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))) {
      const typeParameters = typeParametersOf(source, initializer.typeParameters);
      const returnType = initializer.type ? `: ${initializer.type.getText(source)}` : "";
      return withModifiers(
        modifiers,
        `${kind} ${name}${type} = ${typeParameters}(${parameterList(source, initializer.parameters)})${returnType} => ...;`,
      );
    }
    return withModifiers(modifiers, `${kind} ${name}${type};`);
  });
};

const extractCodeSignatures = (path: string, text: string): string => {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, scriptKindFromPath(path));
  const lines: string[] = [];

  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) {
      lines.push(statement.getText(source));
    } else if (
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isEnumDeclaration(statement)
    ) {
      lines.push(statement.getText(source));
    } else if (ts.isFunctionDeclaration(statement)) {
      const signature = renderFunctionDeclarationSignature(source, statement);
      if (signature) lines.push(signature);
    } else if (ts.isClassDeclaration(statement)) {
      const signature = renderClassSignature(source, statement);
      if (signature) lines.push(signature);
    } else if (ts.isVariableStatement(statement)) {
      lines.push(...renderVariableStatement(source, statement));
    }
  }

  return lines.join("\n\n");
};

const renderFileBody = (file: string, text: string, opts: PackSliceOptions): string => {
  if (!opts.compress || !isJavaScriptLike(file)) {
    return text.endsWith("\n") ? text.slice(0, -1) : text;
  }
  const compressed = extractCodeSignatures(file, text);
  return compressed.length > 0 ? compressed : "// No top-level signatures found.";
};

const renderMergedFiles = async (cwd: string, files: string[], opts: PackSliceOptions): Promise<string> => {
  const sections = await Promise.all(
    files.map(async (file) => {
      const text = await Bun.file(join(cwd, file)).text();
      const body = renderFileBody(file, text, opts);
      return `## File: ${file}\n\n\`\`\`${languageFromPath(file)}\n${body}\n\`\`\``;
    }),
  );

  return [
    "This file is a merged representation of selected repository files, combined by ctxbrew.",
    "",
    "## Files",
    "",
    ...files.map((file) => `- ${file}`),
    "",
    ...sections,
    "",
  ].join("\n");
};

export const packSlice = async (
  cwd: string,
  include: string[],
  ignoredPaths: string[] = [],
  opts: PackSliceOptions = {},
): Promise<PackSliceResult> => {
  if (include.length === 0) {
    throw configError("Slice include list cannot be empty");
  }
  const files = await collectMatches(cwd, include, ignoredPaths);
  return {
    files,
    content: await renderMergedFiles(cwd, files, opts),
  };
};
