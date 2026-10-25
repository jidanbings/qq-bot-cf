/**
 * 识图能力判断：AI 配置里 vision 为 '1' 支持 / '0' 不支持 / auto 按模型名猜。
 * 不写死「没有识图」——后台每个模型都能单独指定。
 */
const VISION_MODEL_HINTS =
  /(gpt-4o|gpt-4\.1|gpt-4-turbo|gpt-4-vision|gpt-4\.5|gpt-5|claude-3|claude-4|claude-sonnet|claude-opus|claude-haiku|gemini|qwen[\w.-]*vl|glm-4[\w.]*v|doubao[\w.-]*vision|deepseek[\w.-]*vl|llava|pixtral|internvl|minicpm-v|yi-vl|step-1v|vision|multimodal|omni)/i;

export function providerSupportsVision(p) {
  if (!p) return false;
  const v = String(p.vision || 'auto');
  if (v === '1') return true;
  if (v === '0') return false;
  return VISION_MODEL_HINTS.test(`${p.model || ''} ${p.baseUrl || ''}`);
}
