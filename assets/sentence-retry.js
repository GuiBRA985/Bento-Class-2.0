/* Bento Class — Sentence retry flow v2 */
(function () {
  "use strict";

  var retryState = {};
  var lastSentenceFeedback = {};

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char];
    });
  }

  function normalizeSpeech(value) {
    return String(value || "").toLowerCase().normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s']/g, " ")
      .replace(/\s+/g, " ").trim();
  }

  function levenshtein(a, b) {
    a = normalizeSpeech(a);
    b = normalizeSpeech(b);
    if (!a) return b.length;
    if (!b) return a.length;

    var previous = [], current = [], i, j;
    for (j = 0; j <= b.length; j++) previous[j] = j;

    for (i = 1; i <= a.length; i++) {
      current[0] = i;
      for (j = 1; j <= b.length; j++) {
        var cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
        current[j] = Math.min(
          current[j - 1] + 1,
          previous[j] + 1,
          previous[j - 1] + cost
        );
      }
      previous = current.slice();
    }
    return previous[b.length];
  }

  function transcriptScore(expected, transcript) {
    var target = normalizeSpeech(expected);
    var heard = normalizeSpeech(transcript);
    if (!target || !heard) return null;

    var distance = levenshtein(target, heard);
    var charScore = 1 - distance / Math.max(target.length, heard.length, 1);

    var targetWords = target.split(" ").filter(Boolean);
    var heardWords = heard.split(" ").filter(Boolean);
    var matched = 0;

    targetWords.forEach(function (word, index) {
      if (heardWords[index] === word || heardWords.indexOf(word) >= 0) matched++;
    });

    var wordScore = matched / Math.max(targetWords.length, 1);

    return Math.max(
      0,
      Math.min(100, Math.round((charScore * 0.55 + wordScore * 0.45) * 100))
    );
  }

  function apiScore(data) {
    if (!data) return null;

    var fields = [
      data.score,
      data.accuracy,
      data.pronunciation_score,
      data.percent,
      data.percentage,
      data.similarity
    ];

    for (var i = 0; i < fields.length; i++) {
      var value = Number(fields[i]);

      if (!isNaN(value) && value >= 0) {
        if (value <= 1) value *= 100;
        return Math.max(0, Math.min(100, Math.round(value)));
      }
    }

    return null;
  }

  function sentenceScore(data, expected, transcript) {
    var fromApi = apiScore(data);
    return fromApi !== null ? fromApi : transcriptScore(expected, transcript);
  }

  function sentencePassed(data, score) {
    if (data) {
      if (
        data.correct === true ||
        data.is_correct === true ||
        data.passed === true
      ) return true;

      var status = String(
        data.correct ||
        data.is_correct ||
        data.result ||
        data.status ||
        ""
      ).toLowerCase();

      if (["true", "correct", "pass", "passed", "ok"].indexOf(status) >= 0) {
        return true;
      }
    }

    return score !== null && score >= 75;
  }

  function feedbackHtml(ok, score, transcript, expected, message) {
    var color =
      ok ? "#16a34a" :
      score !== null && score >= 60 ? "#f59e0b" :
      "#dc2626";

    var html =
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px">' +
      '<div style="font-weight:900;font-size:13px">' +
      (ok ? "✅ Sentence accepted" : "⚠️ Keep on") +
      "</div>";

    if (score !== null) {
      html += '<div style="font-weight:900;font-size:18px">' + score + "%</div>";
    }

    html += "</div>";

    if (score !== null) {
      html +=
        '<div style="height:8px;background:rgba(15,23,42,.12);border-radius:999px;overflow:hidden;margin-bottom:9px">' +
        '<div style="height:100%;width:' + score + "%;background:" + color +
        ';border-radius:999px"></div></div>';
    }

    html +=
      '<div style="font-size:13px;line-height:1.45">' +
      escapeHtml(message) +
      "</div>";

    if (!ok) {
      if (transcript) {
        html +=
          '<div style="margin-top:9px;padding:9px 10px;background:#fff7ed;border-radius:8px;font-size:12px;line-height:1.45;color:#9a3412">' +
          "<strong>I heard:</strong> “" +
          escapeHtml(transcript) +
          "”</div>";
      }

      html +=
        '<div style="margin-top:7px;padding:9px 10px;background:#eff6ff;border-radius:8px;font-size:12px;line-height:1.45;color:#1e40af">' +
        "<strong>Correct sentence:</strong> “" +
        escapeHtml(expected) +
        "”</div>";
    }

    return html;
  }

  function injectStyles() {
    if (document.getElementById("sentenceRetryStyles")) return;

    var style = document.createElement("style");
    style.id = "sentenceRetryStyles";
    style.textContent =
      ".sentence-split{display:flex;width:100%;border-radius:10px;overflow:hidden}" +
      ".sentence-split button{flex:1;border:0;padding:13px 10px;color:#fff;font-size:13px;font-weight:800;font-family:inherit;cursor:pointer}" +
      ".sentence-split .keep-on{background:#dc2626;border-right:1px solid rgba(255,255,255,.35)}" +
      ".sentence-split .listen{background:#2563c8}" +
      ".sentence-split button:active{opacity:.78}";

    document.head.appendChild(style);
  }

  function speakCorrectSentence(text) {
    if (!text) return;

    if (typeof window.saySentence === "function") {
      window.saySentence(text);
      return;
    }

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      var utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 0.82;
      window.speechSynthesis.speak(utterance);
    }
  }

  window.listenSentenceRetry = function (idx) {
    if (
      typeof lesson === "undefined" ||
      !lesson ||
      !lesson.sentences ||
      !lesson.sentences[idx]
    ) return;

    speakCorrectSentence(lesson.sentences[idx]);
  };

  window.renderSentences = function () {
    phase = "sentences";
    updateProgress();
    document.getElementById("hStep").textContent = "3 / 4";

    var allDone =
      Object.keys(sentsDone).length === lesson.sentences.length;

    var html =
      '<div class="phase-label" style="color:#dc2626">' +
      '<div class="phase-dot" style="background:#dc2626"></div>' +
      " Phase 3 - Read Aloud</div>";

    html +=
      '<div class="section">' +
      '<p class="instruction">Read the sentence aloud. If it is not accepted, keep on or listen to the correct model.</p>';

    for (var i = 0; i < lesson.sentences.length; i++) {
      var done = sentsDone[i];
      var retry = !!retryState[i] || !!sentAudioUnlocked[i];

      html +=
        '<div style="border-radius:12px;overflow:hidden;border:2px solid ' +
        (done ? "#16a34a" : "#e2e8f0") +
        ';margin-bottom:8px">';

      html +=
        '<div style="display:flex;gap:10px;align-items:flex-start;background:' +
        (done ? "#dcfce7" : "#f0f4fb") +
        ';padding:12px 14px">';

      html +=
        '<span style="font-size:12px;font-weight:700;color:' +
        (done ? "#16a34a" : "#2563C8") +
        ';min-width:20px;padding-top:2px">' +
        (i + 1) +
        ".</span>";

      html +=
        '<span style="font-family:Georgia,serif;font-size:15px;line-height:1.6;color:#1a1a2e;flex:1">' +
        escapeHtml(lesson.sentences[i]) +
        "</span>";

      html +=
        '<span style="font-size:16px;opacity:' +
        (done ? "1" : "0") +
        '">✅</span></div>';

      if (!done) {
        html += '<div style="padding:10px 12px 12px;background:#f8faff">';

        if (!retry) {
          html +=
            '<button class="act-btn btn-rec" id="srec' +
            i +
            '" onclick="recordItem(' +
            i +
            ',this,\'sent\')" style="width:100%">🎙 Record Sentence</button>';
        } else {
          html +=
            '<div class="sentence-split">' +
            '<button class="keep-on" id="srec' +
            i +
            '" onclick="recordItem(' +
            i +
            ',this,\'sent\')">🎙 Keep on</button>' +
            '<button class="listen" type="button" onclick="listenSentenceRetry(' +
            i +
            ')">🔊 Listen</button>' +
            "</div>";
        }

        html +=
          '<button class="act-btn btn-bug" onclick="reportPronunciationBug(' +
          i +
          ',\'sent\')" style="width:100%;margin-top:8px">🐞 Bug Report</button>' +
          '<div class="feedback" id="sfb' +
          i +
          '"></div></div>';
      }

      html += "</div>";
    }

    html +=
      '</div><div class="divider"></div>' +
      '<div class="btn-wrap">' +
      '<button class="main-btn green" onclick="goEvaluation()" ' +
      (allDone ? "" : "disabled") +
      ">See Final Evaluation →</button>" +
      abandonButtonHtml() +
      "</div>";

    document.getElementById("card").innerHTML = html;

    Object.keys(lastSentenceFeedback).forEach(function (key) {
      var feedback = lastSentenceFeedback[key];
      var el = document.getElementById("sfb" + key);

      if (el && feedback) {
        el.className = "feedback show " + feedback.type;
        el.innerHTML = feedback.html;
      }
    });
  };

  window.evaluateSentence = async function (idx, transcript) {
    closeDefinitionBoxes();

    var sentence = lesson.sentences[idx];

    showFeedback(
      idx,
      "info",
      "Evaluating pronunciation...",
      "sent"
    );

    try {
      var response = await fetch(FN_EVALUATE, {
        method: "POST",
        try {
  var sessionResult = await sb.auth.getSession();

  var accessToken =
    sessionResult.data.session?.access_token;

  if (!accessToken) {
    throw new Error("SESSION_EXPIRED");
  }

  var response = await fetch(FN_EVALUATE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + accessToken,
      "apikey": SUPABASE_ANON
    },
    body: JSON.stringify({
      mode: "pronunciation",
      type: "sentence",
      word: sentence,
      target: sentence,
      transcript: transcript,
      student_native_language: "pt-BR",
      feedback_language: "en-US"
    })
  });
        },
        body: JSON.stringify({
          mode: "pronunciation",
          type: "sentence",
          word: sentence,
          target: sentence,
          transcript: transcript,
          student_native_language: "pt-BR",
          feedback_language: "en-US"
        })
      });

      var data = {};

      try {
        data = await response.json();
      } catch (_) {}

      var score = sentenceScore(data, sentence, transcript);

      // Approval depends on the evaluation result, not on HTTP status alone.
      var ok = sentencePassed(data, score);

      var message = ok
        ? "Very good. Your sentence was clear."
        : "Almost. Listen to the correct sentence and keep on.";

      if (ok) {
        lastSentenceFeedback[idx] = {
          type: "correct",
          html: feedbackHtml(
            true,
            score,
            transcript,
            sentence,
            message
          )
        };

        sentsDone[idx] = true;
        sentsCorrect++;
        delete retryState[idx];
        delete sentAudioUnlocked[idx];

        await saveSession();
        renderSentences();
        speakFeedback(message);
      } else {
        retryState[idx] = true;
        sentAudioUnlocked[idx] = true;

        lastSentenceFeedback[idx] = {
          type: "wrong",
          html: feedbackHtml(
            false,
            score,
            transcript,
            sentence,
            message
          )
        };

        await saveSession();
        renderSentences();
        speakFeedback(message);

        setTimeout(function () {
          speakCorrectSentence(sentence);
        }, 1250);
      }
    } catch (error) {
      retryState[idx] = true;
      sentAudioUnlocked[idx] = true;

      lastSentenceFeedback[idx] = {
        type: "info",
        html: feedbackHtml(
          false,
          transcriptScore(sentence, transcript),
          transcript,
          sentence,
          "I couldn't reach the evaluator. Listen and try again."
        )
      };

      renderSentences();
      speakFeedback(
        "I couldn't reach the evaluator. Listen and try again."
      );

      setTimeout(function () {
        speakCorrectSentence(sentence);
      }, 1250);
    }
  };

  injectStyles();
})();
