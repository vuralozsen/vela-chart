export async function resolve(specifier, context, next){
  if(specifier === '@mathieuc/tradingview')
    return { url: new URL('./tv-stub.mjs', import.meta.url).href, shortCircuit: true };
  return next(specifier, context);
}
