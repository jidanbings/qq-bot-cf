
export const LOGIN_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --surface:#fff;--border:#e5e7eb;--border-strong:#d8dce3;
  --text:#111827;--text-2:#4b5563;--muted:#9aa3af;
  --primary:#2563eb;--green:#059669;--red:#dc2626;--amber:#b45309;
  --grad:linear-gradient(135deg,#3b82f6,#4f46e5 55%,#7c3aed);
}
body{
  min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Roboto,sans-serif;
  background:
    radial-gradient(900px 500px at 12% -10%,#eef4ff 0%,rgba(255,255,255,0) 60%),
    radial-gradient(700px 460px at 100% 0%,#f3f0ff 0%,rgba(255,255,255,0) 55%),
    #f6f7fb;
  color:var(--text);-webkit-font-smoothing:antialiased;
}
a{color:inherit}
.login{width:100%;max-width:400px;background:var(--surface);border:1px solid var(--border);border-radius:18px;box-shadow:0 1px 2px rgba(16,24,40,.04),0 18px 48px rgba(16,24,40,.09);padding:38px 34px 28px;text-align:center}
.logo{width:56px;height:56px;margin:0 auto 18px;background:var(--grad);border-radius:16px;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 20px rgba(59,130,246,.28)}
.logo svg{width:30px;height:30px;color:#fff}
h1{font-size:20px;font-weight:650;letter-spacing:-.01em}
.sub{font-size:13px;color:var(--muted);margin:6px 0 26px}
.field{text-align:left;margin-bottom:16px}
.field input{width:100%;padding:12px 14px;border:1px solid var(--border-strong);border-radius:10px;background:var(--surface);color:var(--text);font-size:14px;font-family:inherit;outline:none;transition:border-color .15s,box-shadow .15s}
.field input:focus{border-color:var(--primary);box-shadow:0 0 0 3px rgba(37,99,235,.12)}
.field input::placeholder{color:#b6bcc6}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;width:100%;padding:12px;border-radius:10px;border:1px solid var(--border-strong);background:var(--surface);color:var(--text);font-size:15px;font-weight:600;font-family:inherit;cursor:pointer;transition:background .15s,border-color .15s,box-shadow .15s,transform .1s}
.btn:active{transform:translateY(1px)}
.btn:disabled{opacity:.55;cursor:not-allowed;transform:none}
.btn.primary{background:var(--grad);border-color:transparent;color:#fff;box-shadow:0 1px 2px rgba(79,70,229,.3)}
.btn.primary:hover{background:linear-gradient(135deg,#2f74f7,#4338ca 55%,#6d28d9);border-color:transparent}
.msg{margin-top:14px;font-size:13px;min-height:20px;color:var(--red);font-weight:500}
.msg.ok{color:var(--green)}
.foot{margin-top:24px;padding-top:16px;border-top:1px solid var(--border);font-size:12px;color:var(--muted)}

/* ---------------- 未配置页（缺 Worker Secrets 时显示） ---------------- */
.setup{width:100%;max-width:620px;background:var(--surface);border:1px solid var(--border);border-radius:18px;box-shadow:0 1px 2px rgba(16,24,40,.04),0 18px 48px rgba(16,24,40,.09);padding:36px 34px 30px;text-align:left}
.setup .head{text-align:center;margin-bottom:24px}
.setup .badge{display:inline-flex;align-items:center;gap:7px;padding:5px 13px;border-radius:999px;background:#fef3c7;color:var(--amber);font-size:12px;font-weight:600;margin-bottom:16px}
.setup .badge i{width:7px;height:7px;border-radius:50%;background:var(--amber)}
.setup h1{font-size:19px;font-weight:650;letter-spacing:-.01em}
.setup .sub{font-size:13px;color:var(--muted);margin-top:7px;line-height:1.7}
.reqs{margin:0 0 22px}
.req{display:flex;gap:12px;align-items:flex-start;padding:13px 15px;border:1px solid var(--border);border-radius:12px;margin-bottom:9px}
.req.missing{background:#fffdf5;border-color:#fde68a}
.req .state{width:20px;height:20px;border-radius:50%;flex:0 0 auto;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;margin-top:1px}
.req.missing .state{background:var(--amber)}
.req.ok .state{background:var(--green)}
.req .body{flex:1;min-width:0}
.req code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12.5px;font-weight:600;color:var(--text);background:#f3f4f6;padding:2px 7px;border-radius:6px}
.req .why{font-size:12.5px;color:var(--text-2);line-height:1.7;margin-top:6px}
.req .how{font-size:12px;color:var(--muted);line-height:1.7;margin-top:6px}
.req .how b{color:var(--text-2);font-weight:600}
.step-note{background:#f8fafc;border:1px solid var(--border);border-radius:12px;padding:16px 18px;font-size:13px;color:var(--text-2);line-height:1.85}
.step-note h2{font-size:13px;font-weight:650;color:var(--text);margin-bottom:9px}
.step-note ol{margin:0;padding-left:19px}
.step-note li{margin-bottom:5px}
.step-note code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;background:#eef2f7;padding:2px 6px;border-radius:5px}
.step-note .warn-line{margin-top:11px;padding-top:11px;border-top:1px dashed var(--border);font-size:12px;color:var(--amber);line-height:1.75}
@media (max-width:560px){.setup{padding:26px 20px 22px}}
`;
