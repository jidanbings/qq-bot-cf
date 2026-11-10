const VISION_MODEL_HINTS =
  /(gpt-4o|gpt-4\.1|gpt-4-turbo|gpt-4-vision|gpt-4\.5|gpt-5|claude-3|claude-4|claude-sonnet|claude-opus|claude-haiku|gemini|qwen[\w.-]*vl|glm-4[\w.]*v|doubao[\w.-]*vision|deepseek[\w.-]*vl|llava|pixtral|internvl|minicpm-v|yi-vl|step-1v|vision|multimodal|omni)/i;

const VISION_QWEN_MAIN = /qwen\s*[-_.]?\d+(\.\d+)?\s*[-_.]?(max|plus|turbo|flash|omni)/i;

export function providerSupportsVision(p) {
  if (!p) return false;
  const v = String(p.vision || 'auto');
  if (v === '1') return true;
  if (v === '0') return false;
  const name = `${p.model || ''} ${p.baseUrl || ''}`;
  return VISION_MODEL_HINTS.test(name) || VISION_QWEN_MAIN.test(name);
}
