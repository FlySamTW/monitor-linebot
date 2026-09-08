/** Verified source DATA, not per-question routing. Native HTML is not PDF. */
const OFFICIAL_MANUAL_ALTERNATIVES_ = {
  S32FM902SC:{kind:'html_manual',verifiedAt:'2026-09-08',
    supportUrl:'https://www.samsung.com/tw/support/model/LS32FM902SCXZW/',
    url:'https://downloadcenter.samsung.com/content/PM/202511/20251126101919651/ZH2/TPE/start_here.html',
    sha256:'f18ad267b05249161faa7fcf57f225eb332bc90e0db9f66d61f6d39bf5e715d0'},
  S27D392GAC:{kind:'blocked_encrypted',verifiedAt:'2026-09-08',
    referenceUrl:'https://downloadcenter.samsung.com/content/UM/202505/20250503043024001/WUG_S39GD_EU_L25_20250326.zip',
    referenceLabel:'英文家族手冊(外區參考)',referenceRegion:'EU',referenceIsModelEvidence:false,
    referenceScope:'封面S27D39*G；尚未核實AC尾碼，非本款PDF證據'},
  S32D392GAC:{kind:'blocked_encrypted',verifiedAt:'2026-09-08',
    referenceUrl:'https://downloadcenter.samsung.com/content/UM/202505/20250503043024001/WUG_S39GD_EU_L25_20250326.zip',
    referenceLabel:'英文家族手冊(外區參考)',referenceRegion:'EU',referenceIsModelEvidence:false,
    referenceScope:'封面S32D39*G；尚未核實AC尾碼，非本款PDF證據'},
  S27F612EAC:{kind:'english_manual',verifiedAt:'2026-09-08',
    docKey:'S61F_F612_EN_PRINTED_FAMILY_241113',language:'EN',sourceRegion:'EU'},
  S32AM703UC:{kind:'blocked_scope',verifiedAt:'2026-09-08',
    referenceUrl:'https://downloadcenter.samsung.com/content/UM/202204/20220403033930001/BN81-21286A-04_WEB_M50A%20M70A_XF_S-CHI_220331.0.pdf',
    referenceLabel:'簡中手冊(中國版參考)',referenceRegion:'CN',referenceIsModelEvidence:false,
    referenceScope:'中國版S32AM70*手冊；不證明台灣M703等同M700或地區服務相同'}
};
function buildOfficialAlternativeQuickReply_(model) {
  const item=OFFICIAL_MANUAL_ALTERNATIVES_[normalizeModelForDisplay(model||'')];
  if(!item) return null;
  if(item.kind==='html_manual'&&/^https:\/\/downloadcenter\.samsung\.com\/content\/PM\//.test(item.url)) {
    return {type:'action',action:{type:'uri',label:'📖 官方HTML手冊',uri:item.url}};
  }
  // URI參考不改hasReadyManualIndex/coverage，不把外區家族檔授權為本款證據。
  if(item.referenceIsModelEvidence===false&&item.referenceLabel&&
      /^https:\/\/downloadcenter\.samsung\.com\/content\/UM\//.test(item.referenceUrl)) {
    return {type:'action',action:{type:'uri',label:item.referenceLabel,uri:item.referenceUrl}};
  }
  return null;
}
