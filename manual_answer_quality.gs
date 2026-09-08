/** Display only verified selected evidence; never invent an OSD action. */
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
