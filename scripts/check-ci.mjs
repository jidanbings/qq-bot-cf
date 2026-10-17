
import { readFileSync } from 'node:fs';

const here = (p) => new URL(p, import.meta.url);
const deploy = readFileSync(here('../scripts/deploy.mjs'), 'utf8');
const setup = readFileSync(here('../scripts/setup.mjs'), 'utf8');

let failed = 0;
function check(name, pass) {
  console.log(`  ${pass ? 'OK  ' : 'FAIL'} ${name}`);
  if (!pass) failed++;
}

console.log('非交互环境守卫：');
check('deploy 检测 stdin.isTTY', /process\.stdin\.isTTY/.test(deploy));
check('deploy 检测 CI 环境变量', /process\.env\.CI/.test(deploy));
check('deploy 检测 WORKERS_CI', /process\.env\.WORKERS_CI/.test(deploy));
check('deploy 支持 --yes 明确跳过', /--yes/.test(deploy));
check('setup 也做了同样的守卫', /process\.stdin\.isTTY/.test(setup) && /process\.env\.CI/.test(setup));
check('setup 非交互时给出替代方案', /需要在交互式终端里运行/.test(setup));

check('deploy 的提问被 interactive 守卫包裹', /if\s*\(!SKIP_CONFIRM\s*&&\s*interactive\)[\s\S]*?rl\.question/.test(deploy));
check('setup 的提问被 interactive 守卫包裹', /if\s*\(!interactive\)[\s\S]*?die\(/.test(setup));

console.log('\n部署永不因缺密钥失败：');
check('脚本里不检查 secret 是否存在', !/secret', 'list'/.test(deploy));
check('不读取密钥值', !/ADMIN_TOKEN\s*=/.test(deploy) && !/readFileSync/.test(deploy));
check('密钥只出现在结尾提醒里', /ADMIN_TOKEN/.test(deploy) && /Variables and Secrets/.test(deploy));

const exitSites = [...deploy.matchAll(/process\.exit\(1\)/g)].map((m) => deploy.slice(Math.max(0, m.index - 80), m.index + 40));
check('所有 exit 点都与密钥无关', exitSites.every((s) => !/密钥|Secret|ADMIN_TOKEN|CONFIG_ENC_KEY/.test(s)));

const setupRawPrompts = setup.match(/createInterface\(/g) || [];
check('setup 只有一处 createInterface（被封进 ask）', setupRawPrompts.length === 1);

console.log('');
if (failed) {
  console.error(`未通过：${failed} 处`);
  process.exit(1);
}
console.log('全部通过。');
