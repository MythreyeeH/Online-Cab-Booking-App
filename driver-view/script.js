
let online = true;
let tripCount = 0;
let earnings = 0;

const rides = [
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
  }
];

const requests = document.getElementById("requests");
const myTrips = document.getElementById("myTrips");

function renderRides() {
  requests.innerHTML = "";

  if (rides.length === 0) {
    requests.textContent = "No new ride requests.";
    return;
  }

  rides.forEach(ride => {
    const card = document.createElement("article");
    card.className = "ride-card";

    const details = document.createElement("div");
    details.innerHTML = `
      <p><strong>Pickup:</strong> ${ride.pickup}</p>
      <p><strong>Destination:</strong> ${ride.destination}</p>
      <p><strong>Fare:</strong> ₹${ride.fare}</p>
    `;

    const actions = document.createElement("div");
    actions.className = "ride-actions";

    const accept = document.createElement("button");
    accept.textContent = "Accept";
    accept.addEventListener("click", () => acceptRide(ride.id));

    const reject = document.createElement("button");
    reject.textContent = "Reject";
    reject.className = "reject";
    reject.addEventListener("click", () => rejectRide(ride.id));

    actions.append(accept, reject);
    card.append(details, actions);
    requests.appendChild(card);
  });
}

function acceptRide(id) {
  const index = rides.findIndex(ride => ride.id === id);
  if (index === -1) return;

  const ride = rides.splice(index, 1)[0];
  tripCount++;
  earnings += ride.fare;

  const trip = document.createElement("p");
  trip.textContent =
    `${ride.pickup} → ${ride.destination} — Accepted`;
  myTrips.appendChild(trip);

  document.getElementById("tripCount").textContent = tripCount;
  document.getElementById("earnings").textContent = `₹${earnings}`;

  renderRides();
}

function rejectRide(id) {
  const index = rides.findIndex(ride => ride.id === id);
  if (index !== -1) rides.splice(index, 1);
  renderRides();
}

document.getElementById("availabilityBtn")
  .addEventListener("click", event => {
    online = !online;
    event.target.textContent = online ? "Go Offline" : "Go Online";
  });

renderRides();
