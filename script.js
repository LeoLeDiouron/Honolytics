(function () {
  "use strict";

  var QUIZ_LEN = 10;
  var TOLERANCE_DEG = 3; // marge d'erreur acceptée pour longitude / latitude

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

  function setFeedback(field, correct, correctValueText) {
    var el = document.getElementById("feedback-" + field);
    el.className = "field-feedback " + (correct ? "ok" : "ko");
    el.textContent = correct ? "✓ correct" : "✗ réponse : " + correctValueText;
  }

  function handleSubmit(e) {
    e.preventDefault();

    var city = currentCity();
    var countryInput = document.getElementById("input-country").value;
    var lonInput = parseFloat(document.getElementById("input-lon").value);
    var latInput = parseFloat(document.getElementById("input-lat").value);

    var countryOk = normalizeStr(countryInput) === normalizeStr(city.country);
    var lonOk = !isNaN(lonInput) && Math.abs(lonInput - city.lon) <= TOLERANCE_DEG;
    var latOk = !isNaN(latInput) && Math.abs(latInput - city.lat) <= TOLERANCE_DEG;

    setFeedback("country", countryOk, city.country);
    setFeedback("lon", lonOk, city.lon + "°");
    setFeedback("lat", latOk, city.lat + "°");

    var points = (countryOk ? 1 : 0) + (lonOk ? 1 : 0) + (latOk ? 1 : 0);
    state.score += points;
    state.results.push({
      city: city,
      countryOk: countryOk,
      lonOk: lonOk,
      latOk: latOk,
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
    var maxScore = state.cities.length * 3;
    document.getElementById("final-score").textContent = state.score + " / " + maxScore;

    var tbody = document.getElementById("result-tbody");
    tbody.innerHTML = "";

    state.results.forEach(function (r) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + capitalize(r.city.name) + "</td>" +
        '<td class="' + (r.countryOk ? "cell-ok" : "cell-ko") + '">' + capitalize(r.city.country) + "</td>" +
        '<td class="' + (r.lonOk ? "cell-ok" : "cell-ko") + '">' + r.city.lon + "°</td>" +
        '<td class="' + (r.latOk ? "cell-ok" : "cell-ko") + '">' + r.city.lat + "°</td>" +
        "<td>" + r.points + " / 3</td>";
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
