import { readFileSync, writeFileSync } from 'node:fs';
const F = 'src/sim/sim.ts';
let lines = readFileSync(F, 'utf8').split('\n');
const nextNonBlank = (arr, i) => { let j = i + 1; while (j < arr.length && arr[j].trim() === '') j++; return j; };

// Rule 1: an affix applyAura object's last property (8-space, `sourceId: mob.id...`)
// that drops straight to a 4-space line (method body) lost its `});` + `}`.
let r1 = 0;
{
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    out.push(lines[i]);
    if (/^        sourceId: mob\.id,/.test(lines[i])) {
      const j = nextNonBlank(lines, i);
      if (j < lines.length && /^    \S/.test(lines[j]) && !/^      \}\)/.test(lines[j])) {
        out.push('      });');
        out.push('    }');
        r1++;
      }
    }
  }
  lines = out;
}

// Rule 2: a method body line (4-space) that drops straight to a 2-space class
// member (`private`/`public`/`// comment`) without an intervening `  }` lost its
// method-closing brace.
let r2 = 0;
{
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    out.push(lines[i]);
    if (/^    \S/.test(lines[i]) && !/^    \}/.test(lines[i])) {
      const j = nextNonBlank(lines, i);
      if (j < lines.length && /^  (private |public |protected |\/\/|\/\*)/.test(lines[j])) {
        out.push('  }');
        out.push('');
        r2++;
      }
    }
  }
  lines = out;
}

writeFileSync(F, lines.join('\n'));
console.log('rule1 (applyAura closers):', r1, ' rule2 (method closers):', r2);
