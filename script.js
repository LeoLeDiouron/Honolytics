(function () {
  "use strict";

  var QUIZ_LEN = 10;

  // Barème : 2 pts pays/capitale + 4 pts latitude + 4 pts longitude = 10 pts / ville
  var GUESS_POINTS = 2;
  var COORD_MAX_POINTS = 4;
  var EXACT_EPSILON = 1e-6;

  var settings = {
    direction: "capital-to-country", // ou "country-to-capital"
    coords: true
  };

  var CONTINENTS = [
    { key: "afrique", label: "Afrique", emoji: "🌍" },
    { key: "amérique du nord", label: "Amérique du Nord", emoji: "🌎" },
    { key: "amérique du sud", label: "Amérique du Sud", emoji: "🌎" },
    { key: "asie", label: "Asie", emoji: "🌏" },
    { key: "europe", label: "Europe", emoji: "🌍" },
    { key: "océanie", label: "Océanie", emoji: "🌏" }
  ];

  var screens = {
    home: document.getElementById("screen-home"),
    quiz: document.getElementById("screen-quiz"),
    result: document.getElementById("screen-result")
  };

  var state = null;

  function showScreen(name) {
    Object.keys(screens).forEach(function (key) {
      screens[key].classList.toggle("hidden", key !== name);
    });
  }

  function normalizeStr(s) {
    return (s || "")
      .toString()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ")
      .replace(/^(le |la |les |l')/, "");
  }

  function levenshteinDistance(a, b) {
    var m = a.length;
    var n = b.length;
    var prev = [];
    var curr = [];
    for (var j = 0; j <= n; j++) prev[j] = j;
    for (var i = 1; i <= m; i++) {
      curr[0] = i;
      for (var j = 1; j <= n; j++) {
        var cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
        curr[j] = Math.min(
          prev[j] + 1,
          curr[j - 1] + 1,
          prev[j - 1] + cost
        );
      }
      prev = curr.slice();
    }
    return prev[n];
  }

  // Tolère les fautes de frappe : le seuil s'élargit avec la longueur du mot correct.
  function isCloseEnough(input, correct) {
    if (input === correct) return true;
    if (!input || !correct) return false;
    var threshold = correct.length <= 4 ? 1 : correct.length <= 8 ? 2 : 3;
    return levenshteinDistance(input, correct) <= threshold;
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  function citiesForScope(scope) {
    if (scope === "monde") return CITIES;
    return CITIES.filter(function (c) {
      return c.continent === scope;
    });
  }

  function cityMaxPoints() {
    return GUESS_POINTS + (settings.coords ? 2 * COORD_MAX_POINTS : 0);
  }

  // ---------- Accueil ----------

  function initOptions() {
    function wireToggle(id, onChange) {
      var group = document.getElementById(id);
      group.querySelectorAll(".toggle-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          group.querySelectorAll(".toggle-btn").forEach(function (b) {
            b.classList.remove("active");
          });
          btn.classList.add("active");
          onChange(btn.getAttribute("data-value"));
        });
      });
    }

    wireToggle("toggle-direction", function (value) {
      settings.direction = value;
    });
    wireToggle("toggle-coords", function (value) {
      settings.coords = value === "yes";
    });
  }

  function renderHome() {
    var grid = document.getElementById("scope-grid");
    grid.innerHTML = "";

    var worldBtn = document.createElement("button");
    worldBtn.className = "scope-btn scope-world";
    worldBtn.innerHTML =
      '<span class="scope-emoji">🌐</span>' +
      '<span class="scope-label">Le monde</span>' +
      '<span class="scope-count">' + CITIES.length + " villes</span>";
    worldBtn.addEventListener("click", function () {
      startQuiz("monde");
    });
    grid.appendChild(worldBtn);

    CONTINENTS.forEach(function (cont) {
      var count = citiesForScope(cont.key).length;
      var btn = document.createElement("button");
      btn.className = "scope-btn";
      btn.innerHTML =
        '<span class="scope-emoji">' + cont.emoji + "</span>" +
        '<span class="scope-label">' + cont.label + "</span>" +
        '<span class="scope-count">' + count + " villes</span>";
      btn.addEventListener("click", function () {
        startQuiz(cont.key);
      });
      grid.appendChild(btn);
    });
  }

  // ---------- Quiz ----------

  function startQuiz(scope) {
    var pool = citiesForScope(scope);
    var length = Math.min(QUIZ_LEN, pool.length);
    state = {
      scope: scope,
      direction: settings.direction,
      coords: settings.coords,
      cities: shuffle(pool).slice(0, length),
      index: 0,
      score: 0,
      results: []
    };
    showScreen("quiz");
    renderCity();
  }

  function currentCity() {
    return state.cities[state.index];
  }

  // Donnée affichée dans la carte, et donnée à deviner dans le champ texte.
  function shownValue(city) {
    return state.direction === "country-to-capital" ? city.country : city.name;
  }

  function guessTarget(city) {
    return state.direction === "country-to-capital" ? city.name : city.country;
  }

  function renderCity() {
    document.getElementById("quiz-progress").textContent =
      "Ville " + (state.index + 1) + "/" + state.cities.length;
    document.getElementById("quiz-score").textContent = "Score : " + state.score;
    document.getElementById("city-name").textContent = shownValue(currentCity());

    if (state.direction === "country-to-capital") {
      document.getElementById("city-question-label").textContent = "Quelle est la capitale de ce pays ?";
      document.getElementById("label-guess").textContent = "Capitale";
      document.getElementById("input-country").placeholder = "ex : Paris";
    } else {
      document.getElementById("city-question-label").textContent = "Quelle est cette ville ?";
      document.getElementById("label-guess").textContent = "Pays";
      document.getElementById("input-country").placeholder = "ex : France";
    }

    document.getElementById("coords-row").classList.toggle("hidden", !state.coords);
    hideCityMap();

    ["country", "lon", "lat"].forEach(function (field) {
      var input = document.getElementById("input-" + field);
      input.value = "";
      input.disabled = false;
      document.getElementById("feedback-" + field).textContent = "";
      document.getElementById("feedback-" + field).className = "field-feedback";
    });

    document.getElementById("input-country").focus();
    document.getElementById("btn-validate").classList.remove("hidden");
    document.getElementById("btn-next").classList.add("hidden");
  }

  // Sous-barème coordonnées :
  //   >5°: 0 pt | <5°: 1 pt | <2°: 2 pts | exacte (partie entière): 3 pts | exacte (avec décimales): 4 pts
  function scoreCoord(input, correct) {
    if (isNaN(input)) {
      return { points: 0, label: "aucune réponse" };
    }
    var diff = Math.abs(input - correct);
    if (diff <= EXACT_EPSILON) {
      return { points: 4, label: "exacte (avec décimales)" };
    }
    if (Math.round(input) === Math.round(correct)) {
      return { points: 3, label: "exacte (partie entière)" };
    }
    if (diff < 2) {
      return { points: 2, label: "à moins de 2°" };
    }
    if (diff < 5) {
      return { points: 1, label: "à moins de 5°" };
    }
    return { points: 0, label: "à plus de 5°" };
  }

  // Carte centrée sur la ville, affichée une fois la réponse validée.
  function showCityMap(city) {
    var delta = 8;
    var bbox = [
      city.lon - delta, city.lat - delta,
      city.lon + delta, city.lat + delta
    ].join(",");
    var iframe = document.getElementById("city-map");
    iframe.src = "https://www.openstreetmap.org/export/embed.html?bbox=" + bbox +
      "&layer=mapnik&marker=" + city.lat + "," + city.lon;
    document.getElementById("city-map-wrap").classList.remove("hidden");
  }

  function hideCityMap() {
    document.getElementById("city-map-wrap").classList.add("hidden");
    document.getElementById("city-map").src = "";
  }

  function feedbackClass(points, max) {
    if (points >= max) return "ok";
    if (points <= 0) return "ko";
    return "warn";
  }

  function setCountryFeedback(correct, correctValueText) {
    var points = correct ? GUESS_POINTS : 0;
    var el = document.getElementById("feedback-country");
    el.className = "field-feedback " + feedbackClass(points, GUESS_POINTS);
    el.textContent =
      (correct ? "✓ correct" : "✗ réponse : " + correctValueText) +
      " (+" + points + "/" + GUESS_POINTS + ")";
    return points;
  }

  function setCoordFeedback(field, result, correctValueText) {
    var el = document.getElementById("feedback-" + field);
    el.className = "field-feedback " + feedbackClass(result.points, COORD_MAX_POINTS);
    el.textContent =
      "réponse : " + correctValueText + "° — " + result.label +
      " (+" + result.points + "/" + COORD_MAX_POINTS + ")";
    return result.points;
  }

  function handleSubmit(e) {
    e.preventDefault();

    var city = currentCity();
    var countryInput = document.getElementById("input-country").value;
    var target = guessTarget(city);

    var countryOk = isCloseEnough(normalizeStr(countryInput), normalizeStr(target));
    var countryPoints = setCountryFeedback(countryOk, target);

    var lonPoints = 0;
    var latPoints = 0;
    if (state.coords) {
      var lonInput = parseFloat(document.getElementById("input-lon").value);
      var latInput = parseFloat(document.getElementById("input-lat").value);
      lonPoints = setCoordFeedback("lon", scoreCoord(lonInput, city.lon), city.lon);
      latPoints = setCoordFeedback("lat", scoreCoord(latInput, city.lat), city.lat);
    }

    var points = countryPoints + lonPoints + latPoints;
    state.score += points;
    state.results.push({
      city: city,
      countryOk: countryOk,
      countryPoints: countryPoints,
      lonPoints: lonPoints,
      latPoints: latPoints,
      points: points
    });

    document.getElementById("quiz-score").textContent = "Score : " + state.score;
    showCityMap(city);

    ["country", "lon", "lat"].forEach(function (field) {
      document.getElementById("input-" + field).disabled = true;
    });

    document.getElementById("btn-validate").classList.add("hidden");
    var nextBtn = document.getElementById("btn-next");
    nextBtn.classList.remove("hidden");
    nextBtn.textContent =
      state.index < state.cities.length - 1 ? "Ville suivante →" : "Voir le résultat →";
    nextBtn.focus();
  }

  function handleNext() {
    if (state.index < state.cities.length - 1) {
      state.index++;
      renderCity();
    } else {
      showResults();
    }
  }

  // ---------- Résultats ----------

  function showResults() {
    showScreen("result");
    var maxPerCity = cityMaxPoints();
    var maxScore = state.cities.length * maxPerCity;
    document.getElementById("final-score").textContent = state.score + " / " + maxScore;

    var isReversed = state.direction === "country-to-capital";
    document.getElementById("th-shown").textContent = isReversed ? "Pays" : "Ville";
    document.getElementById("th-guess").textContent = isReversed ? "Capitale" : "Pays";
    document.getElementById("th-lon").classList.toggle("hidden", !state.coords);
    document.getElementById("th-lat").classList.toggle("hidden", !state.coords);

    var tbody = document.getElementById("result-tbody");
    tbody.innerHTML = "";

    function cellClass(points, max) {
      return "cell-" + feedbackClass(points, max);
    }

    state.results.forEach(function (r) {
      var tr = document.createElement("tr");
      var shown = isReversed ? r.city.country : r.city.name;
      var guessed = isReversed ? r.city.name : r.city.country;
      var html =
        "<td>" + capitalize(shown) + "</td>" +
        '<td class="' + cellClass(r.countryPoints, GUESS_POINTS) + '">' +
          capitalize(guessed) + " (+" + r.countryPoints + "/" + GUESS_POINTS + ")</td>";
      if (state.coords) {
        html +=
          '<td class="' + cellClass(r.lonPoints, COORD_MAX_POINTS) + '">' +
            r.city.lon + "° (+" + r.lonPoints + "/" + COORD_MAX_POINTS + ")</td>" +
          '<td class="' + cellClass(r.latPoints, COORD_MAX_POINTS) + '">' +
            r.city.lat + "° (+" + r.latPoints + "/" + COORD_MAX_POINTS + ")</td>";
      }
      html += "<td>" + r.points + " / " + maxPerCity + "</td>";
      tr.innerHTML = html;
      tbody.appendChild(tr);
    });
  }

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // ---------- Câblage ----------

  document.getElementById("quiz-form").addEventListener("submit", handleSubmit);
  document.getElementById("btn-next").addEventListener("click", handleNext);
  document.getElementById("btn-replay").addEventListener("click", function () {
    startQuiz(state.scope);
  });
  document.getElementById("btn-home").addEventListener("click", function () {
    showScreen("home");
  });

  initOptions();
  renderHome();
  showScreen("home");
})();
