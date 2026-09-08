/** Display only verified selected evidence; never invent an OSD action. */
function isRegisteredPrintedCoverEvidence_(evidence,targetModel,provenance) {
  const state=provenance||{}, item=evidence||{};
  if(state.hashMismatch||state.hashMissing||!item.documentBound||
    !(state.entries||[]).some(function(entry){return entry.hashVerifiedAgainstAttachment===true && /^[a-f0-9]{64}$/i.test(entry.sha256||'');})) return false;
  const scope=[item.excerpt,item.applicabilityExcerpt,item.supportedAnswer].filter(Boolean).join('\n');
  if(manualEvidenceHasModelApplicabilityCaveat_(scope)||
    /depending on (?:the )?model|(?:some|certain) models|may not be supported|optional/i.test(scope)) return false;
  const docs=getEffectiveManualDocuments_();
  return Object.keys(docs).some(function(key){
    const doc=docs[key],registered=findRegisteredPrintedCoverBinding_(doc);
    if(!registered||!doc.models.some(function(model){return normalizeModelForDisplay(model)===normalizeModelForDisplay(targetModel);})) return false;
    const revision=readManualRevision_(key,doc);
    if(!revision) return false;
    return (state.entries||[]).some(function(entry){
      return entry.hashVerifiedAgainstAttachment===true &&
        String(entry.sha256||'').toLowerCase()===String(registered.sourcePdfSha256).toLowerCase();
    });
  });
}

function getManualSourceSwitchIntent_(question) {
  const q=String(question||'');
  // Permission/condition questions ask whether an action is allowed, not how
  // to select a source. Their evidence can be a prohibition in another task.
  if (/(?:期間|時).{0,20}(?:切換|選擇|選取)/.test(q) ||
      (!/怎麼|如何|步驟|路徑/.test(q) && /是否|能否|可否|可不可以|能不能|可以|允許|會不會/.test(q))) return '';
  if (/Anynet|HDMI[ -]?CEC|\bCEC\b/i.test(q)) return 'cec';
  if (!/(?:HDMI|DisplayPort|訊號源|信號源|輸入來源|輸入源|外部裝置|source)/i.test(q) ||
      !/(?:切換|選擇|選取|switch|select)/i.test(q)) return '';
  return /自動|auto/i.test(q) ? 'automatic' : 'manual';
}

function manualSourceSwitchEvidenceMatches_(question, text, heading) {
  const intent=getManualSourceSwitchIntent_(question);
  if (!intent) return true;
  const body=String(text||'').replace(/[「」『』“”"，,：:]/g,'').replace(/\s+/g,' '), title=String(heading||'');
  const cec=/Anynet|HDMI[ -]?CEC/i;
  const automatic=/自動(?:訊號|信號|輸入)源?切換|Auto Source Switch/i;
  if (intent==='cec') return cec.test(title||body);
  if (intent==='automatic') return automatic.test(body);
  if (cec.test(title)||automatic.test(title)) return false;
  if (automatic.test(body) && !/外部裝置間切換|switching between external devices/i.test(title)) return false;
  return /(?:訊號源|信號源|輸入來源|輸入源)(?:畫面|選單|功能表)?(?:中|上)?(?:再|然後|接著)?(?:選擇|選取|切換)(?:到|至)?|(?:選擇|選取|切換)(?:到|至)?(?:所需的?|要使用的?|要顯示的?)?(?:訊號源|信號源|輸入來源|輸入源)|(?:選擇|選取|切換)(?:到|至)?(?:已)?連接的?(?:外部)?裝置|(?:已)?連接的?(?:外部)?裝置(?:間|之間)(?:選擇|選取|切換)|(?:select|choose) (?:the |an |your )?(?:input|source)/i.test(body);
}

// Call before granting supported status: CEC/automatic switching is not the
// same operation as selecting an input, even when all appear on a cited page.
function isManualSourceSwitchAnswerFaithful_(question, answer) {
  const intent=getManualSourceSwitchIntent_(question);
  if (!intent) return true;
  const text=String(answer||'');
  if (intent==='manual' && /Anynet|HDMI[ -]?CEC|自動(?:訊號|信號|輸入)源?切換|Auto Source Switch/i.test(text)) return false;
  if (intent==='automatic' && !/自動|auto/i.test(text)) return false;
  if (intent==='cec' && !/Anynet|HDMI[ -]?CEC/i.test(text)) return false;
  return true;
}

function isVerifiedGenericSourceSelectionCoverage_(answer, question, validEvidence) {
  const q=String(question||'').replace(/\bL?[SCF]\d{2,3}[A-Z0-9]{4,16}\b/gi,'');
  if (getManualSourceSwitchIntent_(q)!=='manual' ||
      /\d|同時|兩邊|支援|相容|有沒有|多少|幾個|最高|最低|限制|自動|CEC|Anynet/i.test(q) ||
      isMultipleManualProcedureClaim_(q)) return false;
  // No broad feature-coverage bypass: only a single input-source selection.
  if (getManualFeatureChecks_(q).some(function(check) {
    return !/^(?:HDMI|DisplayPort|DP|輸入來源|訊號源)$/i.test(String(check.label||check.name||''));
  })) return false;
  if (!isManualSourceSwitchAnswerFaithful_(q,answer) ||
      !manualSourceSwitchEvidenceMatches_(q,answer,'')) return false;
  return (validEvidence||[]).some(function(item) {
    const excerpt=item.excerpt||item.evidenceText||'';
    return /外部裝置間切換|switching between external devices/i.test(String(item.pageHeading||'')) &&
      manualSourceSwitchEvidenceMatches_(q,excerpt,item.pageHeading) &&
      manualSupportedAnswerMatchesExcerpt_(answer,excerpt,q.replace(/HDMI|DisplayPort|\bDP\b/gi,'輸入來源')) &&
      isManualSourceSwitchAnswerFaithful_(q,item.supportedAnswer||answer);
  });
}

function isSafeEvidenceElaboration_(answer, previousVerifiedAnswer, question) {
  const text = String(answer || '').trim();
  const previous = String(previousVerifiedAnswer || '').trim();
  if (!text || !previous || /https?:\/\/|\[(?:AUTO_|MANUAL_|NEED_)/i.test(text)) return false;
  const compact = function (value) { return String(value).replace(/\s+/g, '').toUpperCase(); };
  const oldModels = extractFullModelLikeTokens(previous + '\n' + String(question || ''));
  if (extractFullModelLikeTokens(text).some(function (model) {
    return !oldModels.some(function (old) { return manualEvidenceModelMatchesTarget_(old, model); });
  })) return false;
  if (!manualSupportedAnswerMatchesExcerpt_(text, previous, question)) return false;
  // Quoted labels and path nodes are literal identifiers, not paraphrases.
  const labels = [];
  const quoted = /[「『“"]([^」』”"\n]+)[」』”"]/g;
  let match;
  while ((match = quoted.exec(text))) labels.push(match[1]);
  text.split(/[。；;\n]/).forEach(function (sentence) {
    if (/[>→]/.test(sentence)) sentence.split(/[>→]/).forEach(function (part) {
      labels.push(part.replace(/^(?:請|可以|從|到|進入|開啟|選擇|點選|再|接著|：|:)\s*/g, '').trim());
    });
  });
  if (labels.some(function (label) { return label && !compact(previous).includes(compact(label)); })) return false;
  const normalize = function (value) {
    return compact(value)
      .replace(/切勿|請勿|不可|不能|不可以|不要|不得|別/g, '勿')
      .replace(/變更|更改/g, '切換').replace(/訊號來源/g, '輸入來源')
      .replace(/關掉/g, '關閉').replace(/自行診斷/g, '自我診斷');
  };
  const oldSentences = previous.split(/[。！？!?；;\n]/).map(normalize).filter(Boolean);
  const negative = /勿|不支援|無法|沒有|不提供|未提供|僅限|只有/;
  // These reminders concern the user's workflow only, never device capability.
  const genericReminder = /^(?:(?:開始|操作|測試|診斷)(?:前|之前)[，,：:]?)?(?:先)?(?:把目前的工作告一段落|把手邊的工作告一段落|看完上一則說明|確認自己看懂上一則說明|有不清楚的地方再問|有不清楚的地方可以再問)[。！!]?$/;
  const sentences = text.split(/[。！？!?；;\n]/).map(function (s) { return s.trim(); }).filter(Boolean);
  return sentences.every(function (sentence) {
    if (genericReminder.test(sentence)) return true;
    const normalized = normalize(sentence);
    if (oldSentences.some(function (old) {
      return negative.test(normalized) === negative.test(old) && old.includes(normalized);
    })) return true;
    // No open-ended similarity threshold: new Chinese function names must not
    // disappear inside an otherwise highly overlapping evidence sentence.
    const content = normalized
      .replace(/(?:先|請|再|也|並且|而且|務必|記得|盡量|可以|進行中|的時候|時|期間|操作|目前|這個|這項|該|就|喔|呢|啊|，|,|：|:)/g, '');
    if (!content) return false;
    return oldSentences.some(function (old) {
      if (negative.test(content) !== negative.test(old)) return false;
      const oldContent = old.replace(/(?:先|請|再|也|並且|而且|務必|記得|盡量|可以|進行中|的時候|時|期間|操作|目前|這個|這項|該|就|喔|呢|啊|，|,|：|:)/g, '');
      return oldContent.includes(content);
    });
  });
}

function addManualActionGuidance_(answer, question, plan, claims) {
  const text = String(answer || "");
  if (!isManualActionPathQuestion_(question) || /\[(?:MANUAL_|AUTO_SEARCH_)/.test(text) ||
      !/官方手冊|\[手冊證據:|\[來源:.*手冊/.test(text)) return text;
  const notes = [];
  (plan.fragments || []).forEach(function (fragment) {
    // Only a selected, cited setting section may contribute precautions.
    if (!fragment.menuPath || !(claims || []).some(function (claim) {
      return claim.evidenceId === fragment.evidenceId;
    }) || !text.includes(String(fragment.pageNumber)) || !text.includes(fragment.menuPath) ||
        !manualAnswerCoversQuestionFeatures_(`進入 ${fragment.menuPath}`, question)) return;
    const section = String(fragment.evidenceText || "").replace(/\s*\n\s*/g, " ");
    (section.match(/[^。！？]*[。！？]/g) || []).forEach(function (sentence) {
      const note = sentence.replace(/^[\s―—–\-•●※]+/, "").trim();
      if (note.length <= 180 && /切勿|請勿|不要|不得|務必/.test(note) &&
          !extractManualEvidenceModels_(note).some(function (model) {
            return !manualEvidenceModelMatchesTarget_(model, plan.model);
          }) && !text.replace(/\s/g, "").includes(note.replace(/\s/g, ""))) notes.push(note);
    });
  });
  let result = text.replace(/^((?:[A-Za-z][A-Za-z /+().-]*\s*→\s*)+[A-Za-z][^\n。]*)/,
    "可以，從這裡找：$1。");
  const unique = [...new Set(notes)].slice(0, 2);
  if (unique.length) {
    const position = result.search(/(?:手冊重點[：:]|官方手冊[：:]|\[手冊證據:|\[來源:)/);
    if (position >= 0) result = result.slice(0, position).trimEnd() + "\n\n小提醒：" + unique.join("") + "\n\n" + result.slice(position);
  }
  return result;
}
