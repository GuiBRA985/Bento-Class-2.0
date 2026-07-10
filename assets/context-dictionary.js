/*
  Bento Class — Contextual Dictionary
  Replaces the original defineWord() after aula.html has loaded.

  Uses:
  - Free Dictionary API
  - lesson.sentences as context
  - all meanings returned by the API
  - local cache for the current page
*/

(function () {
  "use strict";

  var definitionCache = {};
  var definitionState = {};

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[char];
    });
  }

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s'-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function stem(word) {
    word = normalize(word);
    if (word.length > 5 && word.endsWith("ing")) return word.slice(0, -3);
    if (word.length > 4 && word.endsWith("ed")) return word.slice(0, -2);
    if (word.length > 4 && word.endsWith("es")) return word.slice(0, -2);
    if (word.length > 3 && word.endsWith("s")) return word.slice(0, -1);
    return word;
  }

  function usefulTokens(text) {
    var stop = {
      the:1, a:1, an:1, and:1, or:1, but:1, to:1, of:1, in:1, on:1,
      at:1, for:1, from:1, with:1, is:1, are:1, was:1, were:1, be:1,
      been:1, being:1, it:1, this:1, that:1, these:1, those:1, i:1,
      you:1, he:1, she:1, we:1, they:1, my:1, your:1, his:1, her:1,
      our:1, their:1, do:1, does:1, did:1, have:1, has:1, had:1
    };

    var seen = {};
    return normalize(text).split(/\s+/).map(stem).filter(function (token) {
      if (!token || token.length < 3 || stop[token] || seen[token]) return false;
      seen[token] = true;
      return true;
    });
  }

  function lessonContextFor(word) {
    var sentences = window.lesson && Array.isArray(window.lesson.sentences)
      ? window.lesson.sentences
      : [];

    var normalizedWord = normalize(word);
    var containing = sentences.filter(function (sentence) {
      return normalize(sentence).split(/\s+/).map(stem).indexOf(stem(normalizedWord)) >= 0;
    });

    return {
      exactSentences: containing,
      text: (containing.length ? containing : sentences).join(" ")
    };
  }

  function extractCandidates(entries, word) {
    var candidates = [];

    (entries || []).forEach(function (entry, entryIndex) {
      (entry.meanings || []).forEach(function (meaning, meaningIndex) {
        (meaning.definitions || []).forEach(function (definition, definitionIndex) {
          if (!definition || !definition.definition) return;

          candidates.push({
            word: entry.word || word,
            phonetic: findPhonetic(entry),
            audioUrl: findAudio(entry),
            partOfSpeech: meaning.partOfSpeech || "",
            definition: definition.definition || "",
            example: definition.example || "",
            synonyms: definition.synonyms || meaning.synonyms || [],
            antonyms: definition.antonyms || meaning.antonyms || [],
            originalOrder:
              entryIndex * 10000 + meaningIndex * 100 + definitionIndex
          });
        });
      });
    });

    return candidates;
  }

  function findPhonetic(entry) {
    if (entry && entry.phonetic) return entry.phonetic;
    var phonetics = entry && entry.phonetics ? entry.phonetics : [];
    for (var i = 0; i < phonetics.length; i++) {
      if (phonetics[i].text) return phonetics[i].text;
    }
    return "";
  }

  function findAudio(entry) {
    var phonetics = entry && entry.phonetics ? entry.phonetics : [];
    for (var i = 0; i < phonetics.length; i++) {
      if (phonetics[i].audio) return phonetics[i].audio;
    }
    return "";
  }

  function scoreCandidate(candidate, context, word) {
    var contextTokens = usefulTokens(context.text);
    var candidateText = [
      candidate.definition,
      candidate.example,
      candidate.partOfSpeech,
      (candidate.synonyms || []).join(" ")
    ].join(" ");

    var candidateTokens = usefulTokens(candidateText);
    var candidateSet = {};
    candidateTokens.forEach(function (token) {
      candidateSet[token] = true;
    });

    var score = 0;

    contextTokens.forEach(function (token) {
      if (candidateSet[token]) score += 4;
      if (normalize(candidateText).indexOf(token) >= 0) score += 1;
    });

    var normalizedWord = stem(word);
    var exampleTokens = usefulTokens(candidate.example);

    if (candidate.example) score += 2;
    if (exampleTokens.indexOf(normalizedWord) >= 0) score += 3;

    context.exactSentences.forEach(function (sentence) {
      usefulTokens(sentence).forEach(function (token) {
        if (candidateSet[token]) score += 6;
      });
    });

    // Prefer common definitions when contextual scores tie.
    score -= candidate.originalOrder * 0.0001;

    return score;
  }

  function rankCandidates(candidates, word) {
    var context = lessonContextFor(word);

    return candidates.map(function (candidate) {
      candidate.contextScore = scoreCandidate(candidate, context, word);
      return candidate;
    }).sort(function (a, b) {
      return b.contextScore - a.contextScore;
    });
  }

  async function fetchDefinitions(word) {
    var key = normalize(word);

    if (definitionCache[key]) return definitionCache[key];

    var response = await fetch(
      "https://api.dictionaryapi.dev/api/v2/entries/en/" +
      encodeURIComponent(word)
    );

    if (!response.ok) throw new Error("Definition not found");

    var data = await response.json();
    var candidates = rankCandidates(extractCandidates(data, word), word);

    if (!candidates.length) throw new Error("Definition not found");

    definitionCache[key] = candidates;
    return candidates;
  }

  function contextSentence(word) {
    var context = lessonContextFor(word);
    return context.exactSentences[0] || "";
  }

  function renderDefinition(box, word, idx, candidates, selectedIndex) {
    var candidate = candidates[selectedIndex];
    if (!candidate) return;

    definitionState[idx] = {
      word: word,
      candidates: candidates,
      selectedIndex: selectedIndex
    };

    var html = "";
    html += '<div class="def-word">' + escapeHtml(word) + "</div>";

    if (candidate.phonetic) {
      html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">';
      html += '<div class="def-ipa">' + escapeHtml(candidate.phonetic) + "</div>";
      html += "</div>";
    }

    if (candidate.partOfSpeech) {
      html += '<div class="def-pos">' +
        escapeHtml(candidate.partOfSpeech) +
        "</div>";
    }

    html += '<div class="def-text">' +
      escapeHtml(candidate.definition) +
      "</div>";

    if (candidate.example) {
      html += '<div class="def-example">"' +
        escapeHtml(candidate.example) +
        '"</div>';
    }

    var sentence = contextSentence(word);
    if (sentence) {
      html += '<div style="margin-top:10px;padding:9px 10px;background:#eff6ff;border-radius:8px;font-size:12px;color:#1e40af;line-height:1.45">';
      html += "<strong>In this lesson:</strong> " + escapeHtml(sentence);
      html += "</div>";
    }

    html += '<div style="font-size:10px;color:#94a3b8;margin-top:8px">';
    html += "Meaning " + (selectedIndex + 1) + " of " + candidates.length;
    html += "</div>";

    html += '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">';

    html += '<button class="def-audio-btn" onclick="speakDefinition(' +
      JSON.stringify(candidate.definition).replace(/</g, "\\u003c") +
      ')">🔊 Repeat definition</button>';

    if (candidate.audioUrl) {
      html += '<button class="def-audio-btn" onclick="playAudio(' +
        JSON.stringify(candidate.audioUrl).replace(/</g, "\\u003c") +
        ')">🔉 Dictionary audio</button>';
    }

    if (candidates.length > 1) {
      html += '<button class="def-audio-btn" style="background:#7c3aed" onclick="showOtherMeaning(' +
        idx +
        ')">↻ Other meaning</button>';
    }

    html += "</div>";
    box.innerHTML = html;

    if (candidate.definition && typeof window.speakDefinition === "function") {
      window.speakDefinition(candidate.definition);
    }
  }

  window.showOtherMeaning = function (idx) {
    var state = definitionState[idx];
    if (!state || !state.candidates.length) return;

    var nextIndex = (state.selectedIndex + 1) % state.candidates.length;
    var box = document.getElementById("def" + idx);
    if (!box) return;

    renderDefinition(
      box,
      state.word,
      idx,
      state.candidates,
      nextIndex
    );
  };

  window.defineWord = async function (word, idx) {
    var box = document.getElementById("def" + idx);
    if (!box) return;

    if (box.classList.contains("show")) {
      box.className = "def-box";
      return;
    }

    box.className = "def-box show";
    box.innerHTML =
      '<div style="font-size:12px;color:#6b7280">Finding the meaning used in this lesson...</div>';

    try {
      var candidates = await fetchDefinitions(word);
      renderDefinition(box, word, idx, candidates, 0);
    } catch (error) {
      box.innerHTML =
        '<div style="font-size:12px;color:#6b7280">No definition found for "' +
        escapeHtml(word) +
        '".</div>';
    }
  };
})();
