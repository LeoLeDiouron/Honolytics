(function () {
  "use strict";

  var QUIZ_LEN = 10;

  // Barème : 2 pts pays + 4 pts latitude + 4 pts longitude = 10 pts / ville
  var COUNTRY_POINTS = 2;
  var COORD_MAX_POINTS = 4;
  var EXACT_EPSILON = 1e-6;
  var CITY_MAX_POINTS = COUNTRY_POINTS + 2 * COORD_MAX_POINTS;

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

  // ---------- Accueil ----------

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

  function renderCity() {
    document.getElementById("quiz-progress").textContent =
      "Ville " + (state.index + 1) + "/" + state.cities.length;
    document.getElementById("quiz-score").textContent = "Score : " + state.score;
    document.getElementById("city-name").textContent = currentCity().name;

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

  function feedbackClass(points, max) {
    if (points >= max) return "ok";
    if (points <= 0) return "ko";
    return "warn";
  }

  function setCountryFeedback(correct, correctValueText) {
    var points = correct ? COUNTRY_POINTS : 0;
    var el = document.getElementById("feedback-country");
    el.className = "field-feedback " + feedbackClass(points, COUNTRY_POINTS);
    el.textContent =
      (correct ? "✓ correct" : "✗ réponse : " + correctValueText) +
      " (+" + points + "/" + COUNTRY_POINTS + ")";
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
    var lonInput = parseFloat(document.getElementById("input-lon").value);
    var latInput = parseFloat(document.getElementById("input-lat").value);

    var countryOk = isCloseEnough(normalizeStr(countryInput), normalizeStr(city.country));
    var lonResult = scoreCoord(lonInput, city.lon);
    var latResult = scoreCoord(latInput, city.lat);

    var countryPoints = setCountryFeedback(countryOk, city.country);
    var lonPoints = setCoordFeedback("lon", lonResult, city.lon);
    var latPoints = setCoordFeedback("lat", latResult, city.lat);

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
    var maxScore = state.cities.length * CITY_MAX_POINTS;
    document.getElementById("final-score").textContent = state.score + " / " + maxScore;

    var tbody = document.getElementById("result-tbody");
    tbody.innerHTML = "";

    function cellClass(points, max) {
      return "cell-" + feedbackClass(points, max);
    }

    state.results.forEach(function (r) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + capitalize(r.city.name) + "</td>" +
        '<td class="' + cellClass(r.countryPoints, COUNTRY_POINTS) + '">' +
          capitalize(r.city.country) + " (+" + r.countryPoints + "/" + COUNTRY_POINTS + ")</td>" +
        '<td class="' + cellClass(r.lonPoints, COORD_MAX_POINTS) + '">' +
          r.city.lon + "° (+" + r.lonPoints + "/" + COORD_MAX_POINTS + ")</td>" +
        '<td class="' + cellClass(r.latPoints, COORD_MAX_POINTS) + '">' +
          r.city.lat + "° (+" + r.latPoints + "/" + COORD_MAX_POINTS + ")</td>" +
        "<td>" + r.points + " / " + CITY_MAX_POINTS + "</td>";
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

  renderHome();
  showScreen("home");
})();
