  if (contentType === 'explanation') {
    console.log("[WS] Explanation Data Payload:", dataPayload); // Log the whole object
    tutorStore.addExplanation(dataPayload);
  } else if (contentType === 'question') {
    tutorStore.addQuestion(dataPayload);
  } 