const STORAGE_KEY = "cabconnect_driver_demo";

const initialState = {
  online: true,
  requests: [
    {
      id: 1,
      pickup: "Anna Nagar, Chennai",
      destination: "T. Nagar, Chennai",
      fare: 250
    },
    {
      id: 2,
      pickup: "Velachery, Chennai",
      destination: "Adyar, Chennai",
      fare: 180
    },
    {
      id: 3,
      pickup: "Guindy, Chennai",
      destination: "Nungambakkam, Chennai",
      fare: 220
    }
  ],
  activeTrip: null,
  completedTrips: []
};

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return structuredClone(initialState);

    const parsed = JSON.parse(saved);

    if (
      typeof parsed.online !== "boolean" ||
      !Array.isArray(parsed.requests) ||
      !Array.isArray(parsed.completedTrips)
    ) {
      return structuredClone(initialState);
    }

    return parsed;
  } catch {
    return structuredClone(initialState);
  }
}

let state = loadState();

const requestsElement = document.getElementById("requests");
const activeTripElement = document.getElementById("activeTrip");
const tripsElement = document.getElementById("myTrips");

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function createRoute(pickup, destination) {
  const route = createElement("div", "route");

  const start = createElement("div", "route-point");
  start.append(
    createElement("span"),
    createElement("strong", "", pickup)
  );

  const end = createElement("div", "route-point destination");
  end.append(
    createElement("span"),
    createElement("strong", "", destination)
  );

  route.append(start, end);
  return route;
}

function renderRequests() {
  requestsElement.replaceChildren();

  if (!state.online) {
    requestsElement.append(
      createElement(
        "div",
        "empty-state",
        "You are offline. Go online to receive ride requests."
      )
    );
    return;
  }

  if (state.requests.length === 0) {
    requestsElement.append(
      createElement(
        "div",
        "empty-state",
        "No new ride requests at the moment."
      )
    );
    return;
  }

  state.requests.forEach(ride => {
    const card = createElement("article", "ride-card");

    const top = createElement("div", "ride-top");
    top.append(
      createElement("h3", "", `Ride Request #${ride.id}`),
      createElement("span", "fare", `₹${ride.fare}`)
    );

    const route = createRoute(ride.pickup, ride.destination);

    const actions = createElement("div", "ride-actions");

    const acceptButton = createElement("button", "accept", "Accept Ride");
    const rejectButton = createElement("button", "reject", "Reject");

    acceptButton.disabled = !!state.activeTrip;
    rejectButton.disabled = !!state.activeTrip;

    acceptButton.addEventListener("click", () => acceptRide(ride.id));
    rejectButton.addEventListener("click", () => rejectRide(ride.id));

    actions.append(acceptButton, rejectButton);
    card.append(top, route, actions);

    if (state.activeTrip) {
      const note = createElement(
        "p",
        "trip-meta",
        "Complete your active trip before accepting another ride."
      );
      card.append(note);
    }

    requestsElement.append(card);
  });
}

function renderActiveTrip() {
  activeTripElement.replaceChildren();

  if (!state.activeTrip) {
    activeTripElement.append(
      createElement(
        "div",
        "empty-state",
        "No active trip. Accept a ride request to begin a journey."
      )
    );
    return;
  }

  const ride = state.activeTrip;
  const card = createElement("article", "ride-card");

  const top = createElement("div", "ride-top");
  top.append(
    createElement("h3", "", `Trip #${ride.id}`),
    createElement("span", "tag tag-blue", "In Progress")
  );

  const fare = createElement("p", "fare", `Estimated fare: ₹${ride.fare}`);

  const completeButton = createElement(
    "button",
    "complete",
    "Complete Trip"
  );

  completeButton.addEventListener("click", completeTrip);

  card.append(
    top,
    createRoute(ride.pickup, ride.destination),
    fare,
    completeButton
  );

  activeTripElement.append(card);
}

function renderTripHistory() {
  tripsElement.replaceChildren();

  if (state.completedTrips.length === 0) {
    tripsElement.append(
      createElement(
        "div",
        "empty-state",
        "No completed trips yet. Your completed rides will appear here."
      )
    );
    return;
  }

  [...state.completedTrips].reverse().forEach(trip => {
    const card = createElement("article", "ride-card");

    const top = createElement("div", "ride-top");

    top.append(
      createElement("h3", "", `Trip #${trip.id}`),
      createElement("span", "completed-label", "✓ Completed")
    );

    const route = createRoute(trip.pickup, trip.destination);

    const fare = createElement("p", "fare", `Earned: ₹${trip.fare}`);

    const date = createElement(
      "p",
      "trip-meta",
      `Completed on: ${trip.completedAt}`
    );

    card.append(top, route, fare, date);
    tripsElement.append(card);
  });
}

function renderDashboard() {
  const today = new Date().toDateString();

  const todaysTrips = state.completedTrips.filter(
    trip => new Date(trip.completedAt).toDateString() === today
  );

  const todaysEarnings = todaysTrips.reduce(
    (total, trip) => total + Number(trip.fare),
    0
  );

  document.getElementById("tripCount").textContent = todaysTrips.length;

  document.getElementById("earnings").textContent =
    `₹${todaysEarnings.toLocaleString("en-IN")}`;

  document.getElementById("requestCount").textContent =
    state.requests.length;

  document.getElementById("requestLabel").textContent =
    `${state.requests.length} request${state.requests.length === 1 ? "" : "s"}`;

  const statusText = document.getElementById("statusText");
  const statusDot = document.getElementById("statusDot");
  const availabilityBtn = document.getElementById("availabilityBtn");

  statusText.textContent = state.online ? "Online" : "Offline";
  statusDot.classList.toggle("offline", !state.online);

  availabilityBtn.textContent = state.online ? "Go Offline" : "Go Online";

  renderRequests();
  renderActiveTrip();
  renderTripHistory();
}

function acceptRide(id) {
  if (!state.online || state.activeTrip) {
    alert("You cannot accept another ride right now.");
    return;
  }

  const index = state.requests.findIndex(ride => ride.id === id);
  if (index === -1) return;

  state.activeTrip = state.requests.splice(index, 1)[0];

  saveState();
  renderDashboard();
}

function rejectRide(id) {
  const index = state.requests.findIndex(ride => ride.id === id);
  if (index === -1) return;

  state.requests.splice(index, 1);

  saveState();
  renderDashboard();
}

function completeTrip() {
  if (!state.activeTrip) return;

  const completed = {
    ...state.activeTrip,
    completedAt: new Date().toISOString()
  };

  state.completedTrips.push(completed);
  state.activeTrip = null;

  saveState();
  renderDashboard();

  alert("Trip completed successfully!");
}

document.getElementById("availabilityBtn").addEventListener("click", () => {
  state.online = !state.online;
  saveState();
  renderDashboard();
});

document.getElementById("resetBtn").addEventListener("click", () => {
  const confirmed = confirm(
    "Are you sure you want to reset all demo data?"
  );

  if (!confirmed) return;

  state = structuredClone(initialState);
  saveState();
  renderDashboard();
});

renderDashboard();