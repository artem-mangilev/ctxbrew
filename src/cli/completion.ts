import { Command } from "commander";
import { usageError } from "../utils/exit.ts";

const TOP_LEVEL = ["init", "build", "get", "completion", "help"];

const bashScript = (): string => `# ctxb bash completion
_ctxb_complete() {
  local cur prev words cword
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"

  if [[ \$COMP_CWORD -eq 1 ]]; then
    COMPREPLY=( \$(compgen -W "${TOP_LEVEL.join(" ")}" -- "\$cur") )
    return 0
  fi
  case "\${COMP_WORDS[1]}" in
    completion)
      if [[ \$COMP_CWORD -eq 2 ]]; then
        COMPREPLY=( \$(compgen -W "bash zsh fish" -- "\$cur") )
      fi
      ;;
  esac
}
complete -F _ctxb_complete ctxb
`;

const zshScript = (): string => `#compdef ctxb
# ctxb zsh completion
_ctxb() {
  local -a top
  top=(${TOP_LEVEL.map((c) => `'${c}'`).join(" ")})
  if (( CURRENT == 2 )); then
    _describe 'command' top
    return
  fi
  case "\${words[2]}" in
    completion)
      if (( CURRENT == 3 )); then
        _values 'shell' 'bash' 'zsh' 'fish'
      fi
      ;;
  esac
}
_ctxb "$@"
`;

const fishScript = (): string => `# ctxb fish completion
complete -c ctxb -n '__fish_use_subcommand' -a '${TOP_LEVEL.join(" ")}'
complete -c ctxb -n '__fish_seen_subcommand_from completion' -a 'bash zsh fish'
`;

export const runCompletion = async (shell: string): Promise<void> => {
  switch (shell) {
    case "bash":
      process.stdout.write(bashScript());
      return;
    case "zsh":
      process.stdout.write(zshScript());
      return;
    case "fish":
      process.stdout.write(fishScript());
      return;
    default:
      throw usageError(`Unknown shell "${shell}"`, "Supported: bash, zsh, fish.");
  }
};

export const registerCompletionCommand = (program: Command): void => {
  program
    .command("completion <shell>")
    .description("Print shell completion script (bash | zsh | fish)")
    .action(async (shell: string) => {
      await runCompletion(shell);
    });
};
