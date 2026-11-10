import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, DEPLOY_CONFIG_FILE, buildDeployConfig, wrangler } from './cf.mjs';

const target = resolve(ROOT, DEPLOY_CONFIG_FILE);
if (!existsSync(target)) {
  try {
    buildDeployConfig({ dbId: 'local-dev', log: () => {} });
    console.log('已生成 .wrangler/deploy.toml（本地 D1 绑定）');
  } catch (e) {
    console.error(`生成本地配置失败：${e.message}`);
    process.exit(1);
  }
}

const port = process.env.PORT || '8787';
console.log(`本地预览：http://127.0.0.1:${port}`);
console.log('提示：首次可在另一个终端跑 npm run seed:memes 导入本地梗图');

const r = wrangler(['dev', '--config', DEPLOY_CONFIG_FILE, '--port', port]);
process.exit(r.ok ? 0 : 1);
