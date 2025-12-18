class MFD_screen extends (typeof BaseInstrument !== "undefined" ? BaseInstrument : class { }) {
    constructor() {
        super();
        this.currentPage = "primary"; // Default page.
        this.pages = ["primary", "map"];
        this.mapInstrument = null; // For handling the map system
        // Other pre-existing fields and methods remain unchanged.
    }

    connectedCallback() {
        if (typeof super.connectedCallback === "function") super.connectedCallback();
        this.canvas = document.getElementById("mfdCanvas");
        if (this.canvas) {
            this.canvas.addEventListener('mousedown', e => this._touchStart(e), false);
            this.canvas.addEventListener('mouseup', e => this._touchEnd(e), false);
        }

        this.initMapSystem(); // Initialize map when component is connected

        if (typeof SimVar !== "undefined") {
            setInterval(() => this.Update(), 50);
        }
        this.Update();
    }

    // Initialize the MSFS Avionics Framework MapSystem
    initMapSystem() {
        if (typeof MapInstrument === "undefined") {
            console.error("MapInstrument or MSFS Framework not available.");
            return;
        }

        this.mapInstrument = new MapInstrument();
        this.mapInstrument.init(this, "mapInstrument"); // Initialize the map instrument

        // Set map ranges
        this.mapInstrument.maxRange = 150; // Max range on the map, in nautical miles
        this.mapInstrument.minRange = 5; // Min range
        this.mapInstrument.addRange(25); // Mid-range for navigation visualization

        // Configure the layers using MapSystem-style methods (e.g. waypoints, terrain)
        this.mapInstrument.addLayer({
            name: "waypoints",
            terrain: true,
            flightPlan: true,
            airspaces: true
        });

        // Attach the map canvas to your map page
        const mapCanvas = document.createElement("div");
        mapCanvas.id = "mapCanvasContainer";
        mapCanvas.style.position = "absolute";
        mapCanvas.style.width = "100%";
        mapCanvas.style.height = "100%";
        document.body.appendChild(mapCanvas);
    }

    Update() {
        // Call the map's update method if it exists
        if (this.mapInstrument) {
            this.mapInstrument.Redraw();
        }

        this.getSimVars();
        this.followTRK();
        if (this.crsLock && this.activeBox === "crs") this.activeBox = null;

        const canvas = this.canvas || document.getElementById("mfdCanvas");

        if (!canvas) return;
        this.canvas = canvas;

        const ctx = canvas.getContext("2d");
        const w = canvas.width, h = canvas.height;
        const cx = w / 2, cy = h / 2;

        ctx.clearRect(0, 0, w, h); // Clear the canvas.

        const R = Math.min(w, h) * 0.43; // Radius used for visuals.

        if (this.currentPage === "primary") {
            this.drawPrimaryPage(ctx, cx, cy, R);
        } else if (this.currentPage === "map") {
            this.drawMapPage(ctx, cx, cy, R);
        }

        this.drawBezel(ctx, w, h);
        this.drawPagingDots(ctx); // Draw paging status dots
        this.drawTouchBoxes(ctx, true); // Ensure touch boxes are drawn and selectable on both pages.
        this.drawTASBox(ctx); // Other universal functionality.
    }

    drawMapPage(ctx, cx, cy, R) {
        if (!this.mapInstrument) {
            console.error("Map system not initialized");
            return;
        }

        const mapBounds = this.canvas.getBoundingClientRect();
        ctx.drawImage(
            document.getElementById("mapCanvasContainer"),
            0, 0, mapBounds.width, mapBounds.height
        ); // Render the map on the MFD screen

        // Additional map details if needed (e.g., overlays)
        this.drawWaypointIdent(ctx, cx, cy, R);
        this.drawDisEte(ctx, cx, cy, R);
    }
}

// Register the instrument with its map capabilities
if (typeof registerInstrument === "function") {
    registerInstrument("simple-glasscockpit-sample", MFD_screen);
}