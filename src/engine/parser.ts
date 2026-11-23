import { synErr } from './errors';
import { ARITY, CONSTS, FN, VARS, tokenize, type BinOp, type ConstName, type FnName, type OpSymbol, type PostOp, type Token, type VarName } from './lexer';

export type Node =
  | { t: 'num'; v: number }
  | { t: 'const'; n: ConstName }
  | { t: 'var'; n: VarName }
  | { t: 'neg'; a: Node }
  | { t: 'bin'; op: BinOp; a: Node; b: Node }
  | { t: 'post'; op: PostOp; a: Node }
  | { t: 'fn'; n: FnName; args: Node[] }
  | { t: 'eq'; a: Node; b: Node };

/**
 * Analyse descendante récursive.
 * Priorités : + − < × ÷ < multiplication implicite (1÷2π = 1/(2π)) < ^ (associatif à droite) < postfixes.
 */
export function parse(src: string): Node {
  const t = tokenize(src);
  let p = 0;
  if (!t.length) throw synErr('Expression vide');
  const peek = (): Token | undefined => t[p];
  const isOp = (...vs: OpSymbol[]): boolean => {
    const x = t[p];
    return !!x && x.k === 'op' && vs.includes(x.v);
  };
  const takeOp = (): OpSymbol => {
    const x = t[p++];
    if (x.k !== 'op') throw synErr();
    return x.v;
  };
  /* parenthèse fermante facultative en fin d'expression, comme sur une calculatrice */
  const close = (): void => {
    const x = peek();
    if (!x) return;
    if (x.k !== ')') throw synErr();
    p++;
  };
  const startsPrimary = (x: Token | undefined): boolean => !!x && (x.k === 'num' || x.k === 'id' || x.k === '(');

  function expr(): Node {
    let a = term();
    while (isOp('+', '-')) {
      const op = takeOp() as BinOp;
      a = { t: 'bin', op, a, b: term() };
    }
    return a;
  }
  function term(): Node {
    let a = factor();
    while (isOp('*', '/')) {
      const op = takeOp() as BinOp;
      a = { t: 'bin', op, a, b: factor() };
    }
    return a;
  }
  function factor(): Node {
    if (isOp('-', '+')) {
      const op = takeOp();
      const a = factor();
      return op === '-' ? { t: 'neg', a } : a;
    }
    return implicit();
  }
  function implicit(): Node {
    let a = power();
    while (startsPrimary(peek())) a = { t: 'bin', op: '*', a, b: power() };
    return a;
  }
  function power(): Node {
    let a = postfix();
    if (isOp('^')) {
      p++;
      a = { t: 'bin', op: '^', a, b: expUnary() };
    }
    return a;
  }
  function expUnary(): Node {
    if (isOp('-', '+')) {
      const op = takeOp();
      const a = expUnary();
      return op === '-' ? { t: 'neg', a } : a;
    }
    return power();
  }
  function postfix(): Node {
    let a = primary();
    while (isOp('!', '%', '²', '³', '⁻¹')) a = { t: 'post', op: takeOp() as PostOp, a };
    return a;
  }
  function primary(): Node {
    const x = t[p++];
    if (!x) throw synErr('Expression incomplète');
    if (x.k === 'num') return { t: 'num', v: x.v };
    if (x.k === '(') {
      const e = expr();
      close();
      return e;
    }
    if (x.k === 'id') {
      if (x.kind === 'const') return { t: 'const', n: CONSTS[x.v] };
      if (x.kind === 'var') return { t: 'var', n: VARS[x.v] };
      const n = FN[x.v];
      let args: Node[] = [];
      const next = peek();
      if (next && next.k === '(') {
        p++;
        const after = peek();
        if (after && after.k !== ')') {
          args.push(expr());
          while (peek()?.k === ',') {
            p++;
            args.push(expr());
          }
        }
        close();
      } else if (n === 'sqrt' || n === 'cbrt') {
        args = [power()];
      } else {
        throw synErr(`Parenthèse attendue après ${x.v}`);
      }
      const [lo, hi] = ARITY[n] ?? [1, 1];
      if (args.length < lo || args.length > hi) {
        throw synErr(`${x.v} attend ${lo === hi ? lo : `${lo} ou ${hi}`} argument${hi > 1 ? 's' : ''}`);
      }
      return { t: 'fn', n, args };
    }
    throw synErr();
  }

  let ast = expr();
  if (peek()?.k === '=') {
    p++;
    ast = { t: 'eq', a: ast, b: expr() };
  }
  const left = peek();
  if (left) throw synErr(left.k === ')' ? 'Parenthèse fermante en trop' : 'Erreur de syntaxe');
  return ast;
}

export function astHas(n: Node, pred: (n: Node) => boolean): boolean {
  if (pred(n)) return true;
  switch (n.t) {
    case 'neg': case 'post': return astHas(n.a, pred);
    case 'bin': case 'eq': return astHas(n.a, pred) || astHas(n.b, pred);
    case 'fn': return n.args.some((a) => astHas(a, pred));
    default: return false;
  }
}
