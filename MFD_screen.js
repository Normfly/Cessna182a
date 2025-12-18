class MFD_screen extends (typeof BaseInstrument !== "undefined" ? BaseInstrument : class { }) {
    constructor() {
        super();
        this.currentPage = "primary"; // Default page.
        this.pages = ["primary", "map"];
        this.RMI1Source = 2; // 0=none, 1=GPS, 2=VOR1 (default)
        this.RMI2Source = 2; // 0=none, 1=GPS, 2=VOR2 (default)
        this.bearing1 = NaN;
        this.bearing2 = NaN;
        this.knobLongPressTimer = null;
        this.knobLongPressFired = false;
        this.touchedBox = null;
        this.knobHoldTimer = null;
        this.debugText = "";
        this.debugText = "TEST";
        this.debugInt = 0;
        this.knobPressStart = null;
        this.heading = 0;
        this.trkSel = 0;
        this.trkHold = false;
        this.crsSel = 0;
        this.hdgSel = 0;
        this.groundTrack = 0;
        this.activeBox = null;
        this.cdiDeflection = 0;
        this.gpsDrivesNav1 = false;
        this.gpsObsActive = false;
        this.hsiBearing = 0;
        this.crsLock = false;
        this.toFromFlag = 1;    //0-OFF, 1-TO,2-FROM
        this.selectedNavSource = "VOR1"; // Default to VOR1 for ILS test
        this.lastNavSource = "VOR1";  // or NAV2 if you prefer
        this.gpsHasGP = false;
        this.nav1loc = false;
        this.nav2loc = false;

        this.waypointIdent = "";
        this.identColor = "#e049b0";
        this.phaseText = "";
        this.distanceToNext = "";
        this.eteToNext = "";
        this.eteToNextStr = "";

        this.navSourceText = ""; // <-- Use this for display!
        this.vtgType = ""; // "GS", "GP", "VNAV", ""
        this.vtgValid = false;
        this.vtgDeflection = 0;

        this.touchBoxes = [
            // HSI BOX TOUCHBOXES
            { id: "trk", x: 90, y: 220, w: 40, h: 40 },
            { id: "crs", x: 190, y: 220, w: 40, h: 40 },
            { id: "cdi", x: 140, y: 230, w: 40, h: 30 },
            // BEZEL KNOB TOUCHBOXES
            // Large knob
            { id: "large_knob_cw", x: 0, y: 265, w: 20, h: 40 },
            { id: "large_knob_ccw", x: 50, y: 265, w: 20, h: 40 },
            // Small knob
            { id: "small_knob_cw", x: 20, y: 255, w: 30, h: 20 },
            { id: "small_knob_ccw", x: 20, y: 305, w: 30, h: 20 },
            // Small knob button
            { id: "small_knob_button", x: 25, y: 280, w: 18, h: 18 }
        ];

        this.bezelImgSrc = "Gi-275_attitude_bezel.png";
        this.compassImgSrc = "compass_card.png";
        this.hsiLayer2ImgSrc = "Gi-275_HSI_layer_2.png";
        this.bugImgSrc = "Gi-275_bug.png";
        this.cdiVertImgSrc = "CDI.png";
        this.simFolder = "coui://html_ui/Pages/VCockpit/Instruments/MFD_screen/";
        this.localFolder = "images/MFD_screen/";
        this.images = {};

        const simMode = (typeof SimVar !== "undefined");
        const imageMap = [
            { key: "bezelImg", src: this.bezelImgSrc, sim: this.simFolder + this.bezelImgSrc },
            { key: "compassImg", src: this.compassImgSrc, sim: this.simFolder + this.compassImgSrc },
            { key: "hsiLayer2Img", src: this.hsiLayer2ImgSrc, sim: this.simFolder + this.hsiLayer2ImgSrc },
            { key: "bugImg", src: this.bugImgSrc, sim: this.simFolder + this.bugImgSrc },
            { key: "cdiVertImg", src: this.cdiVertImgSrc, sim: this.simFolder + this.cdiVertImgSrc },
            { key: "circle", src: "circle.png", sim: this.simFolder + "circle.png" }
        ];
        for (const entry of imageMap) {
            this.images[entry.key] = new Image();
            this.images[entry.key].onload = () => { this.Update && this.Update(); };
            this.images[entry.key].onerror = function () { console.log("Image load error:", this.src); };
            this.images[entry.key].src = simMode ? entry.sim : entry.src;
        }
    }

    //WTGarmin_LNavData_CDI_Scale_Label
    flightPhaseLabel(idx) {
        switch (idx) {
            case 0: return "DPRT";        // Departure
            case 1: return "TERM";        // Terminal
            case 2: return "TERM";        // TerminalDeparture
            case 3: return "TERM";        // TerminalArrival
            case 4: return "ENR";         // Enroute
            case 5: return "OCN";         // Oceanic
            case 6: return "LNAV";        // LNav
            case 7: return "LNAV+V";      // LNavPlusV
            case 8: return "APPR";        // Visual
            case 9: return "LNAV/VNAV";   // LNavVNav
            case 10: return "LP";         // LP
            case 11: return "LP+V";       // LPPlusV
            case 12: return "LPV";        // LPV
            case 13: return "APR";        // Approach
            case 14: return "MAPR";       // MissedApproach
            default: return "";
        }
    }

    get isInteractive() { return true; }
    get templateID() { return "MFD_screen_ID"; }

    getSimVars() {
        if (typeof SimVar !== "undefined" && typeof SimVar.GetSimVarValue === "function") {
            this.cdiNeedleValid = !!SimVar.GetSimVarValue("HSI CDI NEEDLE VALID", "Bool");
            const tasKts = SimVar.GetSimVarValue("AIRSPEED TRUE", "Knots");
            if (typeof tasKts === "number" && isFinite(tasKts)) {
                this.tasMph = Math.round(tasKts * 1.15078);
            } else {
                this.tasMph = null;
            }
            // --- Heading (degrees, normalized) ---
            this.heading = (SimVar.GetSimVarValue("PLANE HEADING DEGREES MAGNETIC", "degrees") || 0);
            this.nav1loc = !!SimVar.GetSimVarValue("NAV HAS LOCALIZER:1", "Bool");
            this.nav2loc = !!SimVar.GetSimVarValue("NAV HAS LOCALIZER:2", "Bool");
            // --- read GPS ground magnetic track and convert to degrees (normalize 0..360) ---
            let gpsTrackRad = null;
            gpsTrackRad = SimVar.GetSimVarValue("GPS GROUND MAGNETIC TRACK:1", "radians");
            if (gpsTrackRad === null || gpsTrackRad === undefined) {
                gpsTrackRad = SimVar.GetSimVarValue("GPS GROUND MAGNETIC TRACK", "radians");
            }
            if (typeof gpsTrackRad === "number" && isFinite(gpsTrackRad)) {
                let deg = gpsTrackRad * (180 / Math.PI);
                this.trackMag = (deg % 360 + 360) % 360;
            } else {
                // fallback to heading if GPS track isn't available
                this.trackMag = (typeof this.heading === "number") ? this.heading : 0;
            }
            if (this.tasMph < 40) this.trackMag = this.heading;// at low speed, use heading as track
            // --- RMI Bearing Needle logic ---
            // Bearing 1 (RMI1Source): 0=none, 1=GPS, 2=VOR1
            if (this.RMI1Source === 1) {
                const gpsBearing = SimVar.GetSimVarValue("GPS WP BEARING", "degrees");
                this.bearing1 = isFinite(gpsBearing) ? gpsBearing : NaN;
            } else if (this.nav1loc) {//localizer, no RMI
                this.bearing1 = NaN;
            } else if (this.RMI1Source === 2) {
                let relBearing = SimVar.GetSimVarValue("NAV RELATIVE BEARING TO STATION:1", "degrees");
                if (!isFinite(relBearing) || relBearing === 90) {
                    this.bearing1 = NaN;
                } else {
                    this.bearing1 = ((this.heading + relBearing + 360) % 360);
                }
            } else {
                this.bearing1 = NaN;
            }

            // Bearing 2 (RMI2Source): 0=none, 1=GPS, 2=VOR2
            if (this.RMI2Source === 1) {
                const gpsBearing = SimVar.GetSimVarValue("GPS WP BEARING", "degrees");
                this.bearing2 = isFinite(gpsBearing) ? gpsBearing : NaN;
            } else if (this.nav2loc) {//localizer, no RMI
                this.bearing2 = NaN;
            } else if (this.RMI2Source === 2) {
                let relBearing = SimVar.GetSimVarValue("NAV RELATIVE BEARING TO STATION:2", "degrees");
                if (!isFinite(relBearing) || relBearing === 90) {
                    this.bearing2 = NaN;
                } else {
                    this.bearing2 = ((this.heading + relBearing + 360) % 360);
                }
            } else {
                this.bearing2 = NaN;
            }

            // --- Other SimVars ---
            this.groundTrack = ((SimVar.GetSimVarValue("GPS GROUND MAGNETIC TRACK", "radians") || 0) * 180 / Math.PI) % 360;
            this.gpsHasGP = !!SimVar.GetSimVarValue("GPS HAS GLIDEPATH", "Bool");
            this.trkSel = Number((SimVar.GetSimVarValue("L:TRK_SEL", "Number") || 0) + 360) % 360;
            this.trkHold = !!SimVar.GetSimVarValue("L:TRK_HOLD", "Bool");
            this.hdgSel = Number(SimVar.GetSimVarValue("AUTOPILOT HEADING BUG", "degrees") || 0);
            this.gpsObsActive = !!SimVar.GetSimVarValue("GPS OBS ACTIVE", "Bool");
            this.hsiBearing = ((SimVar.GetSimVarValue("HSI BEARING", "Degrees") || 0) + 360) % 360;
            this.cdiDeflection = Number(SimVar.GetSimVarValue("HSI CDI NEEDLE", "Number")) || 0;
            this.toFromFlag = Number(SimVar.GetSimVarValue("NAV TOFROM:1", "Number")) || 0;

            // --- NAV source selection ---
            let simGpsDrivesNav1 = !!SimVar.GetSimVarValue("GPS DRIVES NAV1", "Bool");
            if (simGpsDrivesNav1) {
                this.selectedNavSource = "GPS";
            } else {
                this.selectedNavSource = this.lastNavSource;
            }

            // --- CRS/course logic, ETE/distance/ident/phase logic ---
            if (this.selectedNavSource === "GPS") {
                this.gpsDrivesNav1 = true;
                if (this.gpsObsActive) {
                    this.crsSel = ((SimVar.GetSimVarValue("GPS OBS VALUE", "Degrees") || 0) + 360) % 360;
                } else {
                    this.crsSel = ((SimVar.GetSimVarValue("NAV OBS:1", "Degrees") || 0) + 360) % 360;
                }
                this.crsLock = !this.gpsObsActive;
                this.courseToDraw = this.gpsObsActive ? this.crsSel : this.hsiBearing;

                this.navSourceText = "GPS";
                this.waypointIdent = SimVar.GetSimVarValue("GPS WP NEXT ID", "string") || "";
                this.identColor = "#e049b0";

                // Flight Phase Label via helper function:
                let phaseIdx = Number(SimVar.GetSimVarValue("L:WTGarmin_LNavData_CDI_Scale_Label", "number"));
                this.phaseText = this.flightPhaseLabel(phaseIdx);

                let dist_m = Number(SimVar.GetSimVarValue("GPS WP DISTANCE", "meters")) || 0;
                if (dist_m < 0.05) dist_m = 0;
                this.distanceToNext = dist_m > 0 ? (dist_m / 1852).toFixed(1) : "";
                this.eteToNext = Number(SimVar.GetSimVarValue("GPS ETE", "seconds")) || "";
                if (this.eteToNext !== "" && !isNaN(this.eteToNext)) {
                    let eteInt = Math.floor(Number(this.eteToNext));
                    let eteMin = Math.floor(eteInt / 60);
                    let eteSec = eteInt % 60;
                    this.eteToNextStr = eteMin.toString().padStart(2, "0") + ":" + eteSec.toString().padStart(2, "0");
                } else {
                    this.eteToNextStr = "";
                }
            } else if (this.selectedNavSource === "VOR1") {
                this.gpsDrivesNav1 = false;
                this.crsLock = false;
                this.crsSel = ((SimVar.GetSimVarValue("NAV OBS:1", "Degrees") || 0) + 360) % 360;
                this.courseToDraw = this.crsSel;
                let locAvailable = !!SimVar.GetSimVarValue("NAV HAS LOCALIZER:1", "Bool");
                let gsAvailable = !!SimVar.GetSimVarValue("NAV HAS GLIDE SLOPE:1", "Bool");
                this.navSourceText = locAvailable && gsAvailable ? "ILS1"
                    : locAvailable && !gsAvailable ? "LOC1" : "VOR1";
                this.waypointIdent = SimVar.GetSimVarValue("NAV IDENT:1", "string") || "";
                this.identColor = "#00ff00";
                this.phaseText = gsAvailable ? "APR" : "ENR";
                this.distanceToNext = SimVar.GetSimVarValue("NAV DME:1", "nautical miles") || "";
                let dme_nm = parseFloat(this.distanceToNext) || 0;
                let gs_mps = Number(SimVar.GetSimVarValue("GROUND VELOCITY", "meters per second")) || 0;
                let gs_knots = gs_mps * 1.9438444924406;
                let eteSec = (gs_knots > 10 && dme_nm > 0) ? (dme_nm / gs_knots) * 3600 : 0;
                if (eteSec > 0) {
                    let eteInt = Math.floor(eteSec);
                    let eteMin = Math.floor(eteInt / 60);
                    let eteSecR = eteInt % 60;
                    this.eteToNext = eteInt;
                    this.eteToNextStr = eteMin.toString().padStart(2, "0") + ":" + eteSecR.toString().padStart(2, "0");
                } else {
                    this.eteToNext = "";
                    this.eteToNextStr = "";
                }
            } else if (this.selectedNavSource === "VOR2") {
                this.gpsDrivesNav1 = false;
                this.crsLock = false;
                this.crsSel = ((SimVar.GetSimVarValue("NAV OBS:2", "Degrees") || 0) + 360) % 360;
                this.courseToDraw = this.crsSel;
                let locAvailable = !!SimVar.GetSimVarValue("NAV HAS LOCALIZER:2", "Bool");
                let gsAvailable = !!SimVar.GetSimVarValue("NAV HAS GLIDE SLOPE:2", "Bool");
                this.navSourceText = locAvailable && gsAvailable ? "ILS2"
                    : locAvailable && !gsAvailable ? "LOC2" : "VOR2";
                this.waypointIdent = SimVar.GetSimVarValue("NAV IDENT:2", "string") || "";
                this.identColor = "#00ff00";
                this.phaseText = gsAvailable ? "APR" : "ENR";
                this.distanceToNext = SimVar.GetSimVarValue("NAV DME:2", "nautical miles") || "";
                let dme_nm = parseFloat(this.distanceToNext) || 0;
                let gs_mps = Number(SimVar.GetSimVarValue("GROUND VELOCITY", "meters per second")) || 0;
                let gs_knots = gs_mps * 1.9438444924406;
                let eteSec = (gs_knots > 10 && dme_nm > 0) ? (dme_nm / gs_knots) * 3600 : 0;
                if (eteSec > 0) {
                    let eteInt = Math.floor(eteSec);
                    let eteMin = Math.floor(eteInt / 60);
                    let eteSecR = eteInt % 60;
                    this.eteToNext = eteInt;
                    this.eteToNextStr = eteMin.toString().padStart(2, "0") + ":" + eteSecR.toString().padStart(2, "0");
                } else {
                    this.eteToNext = "";
                    this.eteToNextStr = "";
                }
            }

            // --- Vertical Guidance Detection ---
            this.vtgType = "";
            this.vtgValid = false;
            this.vtgDeflection = 0;
            // ILS or VOR approach (green GS diamond)
            if (
                (this.selectedNavSource === "VOR1" || this.selectedNavSource === "VOR2") &&
                !!SimVar.GetSimVarValue("NAV HAS GLIDE SLOPE:1", "Bool")
            ) {
                this.vtgType = "GS";
                this.vtgValid = true;
                this.vtgDeflection = Number(SimVar.GetSimVarValue("HSI GSI NEEDLE", "Number")) || 0;
            // LPV/WAAS GPS approach: magenta GP diamond
            } else if (
                !!SimVar.GetSimVarValue("GPS HAS GLIDEPATH", "Bool")
            ) {
                this.vtgType = "GP";
                this.vtgValid = true;
                this.vtgDeflection = Number(SimVar.GetSimVarValue("HSI GSI NEEDLE", "Number")) || 0;
            // GPS VNAV vertical guidance (magenta "V")
            } else if (
                this.selectedNavSource === "GPS" &&
                !!SimVar.GetSimVarValue("L:PMS50_VNAV_PATH_AVAILABLE", "Bool")
            ) {
                this.vtgType = "VNAV";
                this.vtgValid = true;
                this.vtgDeflection = Number(SimVar.GetSimVarValue("L:PMS50_VNAV_PATH_NEEDLE", "Number")) || 0;
            }
        }
        // --- TEST MODE (sliders/controls from browser window) ---
        else {
            this.tasMph = 115;
            this.heading = window.testHeading || 0;
            if (this.RMI1Source === 1) {
                this.bearing1 = window.testBearing1 || NaN;
            } else if (this.RMI1Source === 2) {
                this.bearing1 = ((this.heading + (window.testBearing1 || 0) + 360) % 360);
            } else {
                this.bearing1 = NaN;
            }
            if (this.RMI2Source === 1) {
                this.bearing2 = window.testBearing2 || NaN;
            } else if (this.RMI2Source === 2) {
                this.bearing2 = ((this.heading + (window.testBearing2 || 0) + 360) % 360);
            } else {
                this.bearing2 = NaN;
            }
            this.trkSel = window.testTrack || 0;
            this.crsSel = window.testCrs || 0;
            this.gpsObsActive = !!window.testGpsObs;
            this.hsiBearing = window.testHsiBearing || 0;
            this.cdiDeflection = window.testCdiDeflection || 0;
            this.toFromFlag = (window.testToFromFlag !== undefined ? window.testToFromFlag : 1);

            // Vertical guidance (test mode: copy, extend, or override as needed)
            // USE or DEFAULT vtgType/vtgValid/vtgDeflection
            this.vtgType = (window.testVtgType !== undefined) ? window.testVtgType : "GP";
            this.vtgValid = (window.testVtgValid !== undefined) ? !!window.testVtgValid : true;
            this.vtgDeflection = (window.testVtgDeflection !== undefined) ? window.testVtgDeflection : 0;
            this.selectedNavSource = "GPS";

            // box/phase logic for test mode (unchanged)
            if (this.selectedNavSource === "GPS") {
                this.gpsDrivesNav1 = true;
                this.crsSel = window.testCrs1 || 0;
                this.crsLock = !this.gpsObsActive;
                this.courseToDraw = this.gpsObsActive ? this.crsSel : this.hsiBearing;
                this.waypointIdent = window.testIdent || "RW31";
                this.identColor = "#e049b0";
                this.phaseText = window.testPhaseText || "ENR";
                this.navSourceText = "GPS";
                this.distanceToNext = window.testDistanceToNext || "14.7";
                this.eteToNext = window.testEteToNext || 365;
                if (this.eteToNext !== "" && !isNaN(this.eteToNext)) {
                    let eteInt = parseInt(this.eteToNext, 10);
                    let eteMin = Math.floor(eteInt / 60);
                    let eteSec = eteInt % 60;
                    this.eteToNextStr = eteMin.toString().padStart(2, "0") + ":" + eteSec.toString().padStart(2, "0");
                } else {
                    this.eteToNextStr = "";
                }
            } else {
                this.gpsDrivesNav1 = false;
                this.crsLock = false;
                this.crsSel = window.testCrs1 || 0;
                this.courseToDraw = this.crsSel;
                this.waypointIdent = window.testIdent || "ILAX";
                this.identColor = "#00ff00";
                let chSuffix = (this.selectedNavSource === "VOR2") ? "2" : "1";
                let navRaw = window.testNavSourceText || "ILS";
                this.navSourceText = navRaw + chSuffix;
                this.phaseText = window.testPhaseText || "APR";
                this.distanceToNext = window.testDistanceToNext || "14.7";
                this.eteToNext = window.testEteToNext || 365;
                if (this.eteToNext !== "" && !isNaN(this.eteToNext)) {
                    let eteInt = parseInt(this.eteToNext, 10);
                    let eteMin = Math.floor(eteInt / 60);
                    let eteSec = eteInt % 60;
                    this.eteToNextStr = eteMin.toString().padStart(2, "0") + ":" + eteSec.toString().padStart(2, "0");
                } else {
                    this.eteToNextStr = "";
                }
            }
        }
    }

    connectedCallback() {
        if (typeof super.connectedCallback === "function") super.connectedCallback();
        this.canvas = document.getElementById("mfdCanvas");
        if (this.canvas) {
            this.canvas.addEventListener('mousedown', e => this._touchStart(e), false);
            this.canvas.addEventListener('mouseup', e => this._touchEnd(e), false);
        }
        if (typeof SimVar !== "undefined") {
            setInterval(() => this.Update(), 50);
            setInterval(() => this.pollMFDKnobDeltas(), 50);
            setInterval(() => this.pollMFDKnobButton(), 50);
        }
        this.Update();
    }

    pollMFDKnobDeltas() {
        // Static variables to track last time and fast-spin state
        if (!this._knobLastSmallTime) this._knobLastSmallTime = 0;
        if (!this._knobLastLargeTime) this._knobLastLargeTime = 0;

        const now = Date.now();

        let smallDelta = (typeof SimVar !== "undefined") ? SimVar.GetSimVarValue("L:MFD_KnobSmallDelta", "number") || 0 : 0;
        if (smallDelta !== 0) {
            let timeSince = now - this._knobLastSmallTime;
            this._knobLastSmallTime = now;

            // Fast spin: <70ms between events, normal: 70-250ms, slow: >250ms
            let step = 1;
            if (Math.abs(smallDelta) > 1) {
                // If hardware sends burst increments, apply all at once
                step = Math.abs(smallDelta);
            } else if (timeSince < 70) {
                step = 10;   // Very fast: rotate fast!
            } else if (timeSince < 250) {
                step = 3;    // Medium: rotate moderately fast
            }

            this.handleKnobDelta(step * Math.sign(smallDelta), "small");
            SimVar.SetSimVarValue("L:MFD_KnobSmallDelta", "number", 0);
        }

        let largeDelta = (typeof SimVar !== "undefined") ? SimVar.GetSimVarValue("L:MFD_KnobLargeDelta", "number") || 0 : 0;
        if (largeDelta !== 0) {
            let timeSince = now - this._knobLastLargeTime;
            this._knobLastLargeTime = now;

            let step = 1;
            if (Math.abs(largeDelta) > 1) {
                step = Math.abs(largeDelta);
            } else if (timeSince < 70) {
                step = 10;
            } else if (timeSince < 250) {
                step = 3;
            }
            this.handleKnobDelta(step * Math.sign(largeDelta), "large");
            SimVar.SetSimVarValue("L:MFD_KnobLargeDelta", "number", 0);
        }
    }

    pollMFDKnobButton() {
        // Long press logic
        let btnLongVal = (typeof SimVar !== "undefined") ? SimVar.GetSimVarValue("L:MFD_KnobButtonLong", "number") || 0 : 0;
        if (btnLongVal === 1) {
            this.handleKnobSyncRaw();
            SimVar.SetSimVarValue("L:MFD_KnobButtonLong", "number", 0);
        }

        // Short press logic (future, if implemented)
        let btnShortVal = (typeof SimVar !== "undefined") ? SimVar.GetSimVarValue("L:MFD_KnobButtonShort", "number") || 0 : 0;
        if (btnShortVal === 1) {
            this.handleKnobShortPress();
            SimVar.SetSimVarValue("L:MFD_KnobButtonShort", "number", 0);
        }
    }

    handleKnobShortPress() {
        //future implementation
    }

    _touchStart(e) {
        let rect = this.canvas.getBoundingClientRect();
        let x, y;
        if (e.touches && e.touches.length > 0) {
            x = e.touches[0].clientX - rect.left;
            y = e.touches[0].clientY - rect.top;
        } else {
            x = e.clientX - rect.left;
            y = e.clientY - rect.top;
        }

        this.touchedBox = null;
        for (let box of this.touchBoxes) {
            if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) {
                this.touchedBox = box;
                break;
            }
        }

        if (this.touchedBox) {
            if (this.touchedBox.id === "trk") {
                this.activeBox = "trk";
                this.debugText = "Selected TRK";
            } else if (this.touchedBox.id === "crs" && !this.crsLock) {
                this.activeBox = "crs";
                this.debugText = "Selected CRS";
            } else if (this.touchedBox.id === "cdi") {
                this.cycleNavSource();
                this.debugText = "Cycle Nav Source";
            }

            // Small knob button: handle long press with timer (sync logic, raw data)
            if (this.touchedBox.id === "small_knob_button") {
                this.knobPressBox = this.touchedBox.id;
                this.knobLongPressFired = false;
                this.knobLongPressTimer = setTimeout(() => {
                    this.handleKnobSyncRaw(); // <-- unified sync logic!
                    this.knobLongPressFired = true;
                    this.debugText = "Knob Button Long Press (DOWN RAW SYNC)";
                    this.Update();
                }, 2000);
                this.debugText = "Knob Button Down";
            }

            // Small knob CW/CCW
            if (this.touchedBox.id === "small_knob_cw") {
                this.knobHoldTimer = setInterval(() => this.handleKnobDelta(+1, "small"), 120);
                this.handleKnobDelta(+1, "small");
            } else if (this.touchedBox.id === "small_knob_ccw") {
                this.knobHoldTimer = setInterval(() => this.handleKnobDelta(-1, "small"), 120);
                this.handleKnobDelta(-1, "small");
            }
            // Large knob CW/CCW (future)
            if (this.touchedBox.id === "large_knob_cw") {
                this.knobHoldTimer = setInterval(() => this.handleKnobDelta(+1, "large"), 120);
                this.handleKnobDelta(+1, "large");
            } else if (this.touchedBox.id === "large_knob_ccw") {
                this.knobHoldTimer = setInterval(() => this.handleKnobDelta(-1, "large"), 120);
                this.handleKnobDelta(-1, "large");
            }
        }

        this.Update();
    }

    _touchEnd(e) {
        // For small knob button, check if long press already fired
        if (this.knobPressBox === "small_knob_button") {
            if (this.knobLongPressTimer) {
                clearTimeout(this.knobLongPressTimer);
                this.knobLongPressTimer = null;
            }
            if (!this.knobLongPressFired) {
                this.handleKnobShortPress();
                this.debugText = "Knob Button Short Press (UP)";
            }
        }

        this.knobPressBox = null;
        this.knobLongPressFired = false;

        if (this.knobHoldTimer) {
            clearInterval(this.knobHoldTimer);
            this.knobHoldTimer = null;
        }

        if (this.touchedBox) {
            this.debugText += ` | Released: ${this.touchedBox.id}`;
        }
        this.Update();
    }

    // --- Unified KNOB delta function ---
    handleKnobDelta(delta, size) {
        if (size === "small") {
            if (this.activeBox === "trk") {
                let newTrack = (this.trkSel + delta + 360) % 360;
                this.trkSel = newTrack;
                if (typeof SimVar !== "undefined") SimVar.SetSimVarValue("L:TRK_SEL", "Number", newTrack);
                window.testTrack = newTrack;
            } else if (this.activeBox === "crs" && !this.crsLock) {
                let newCrs = (this.crsSel + delta + 360) % 360;
                this.crsSel = newCrs;
                if (typeof SimVar !== "undefined") {
                    const navObsVar = (this.selectedNavSource === "VOR2") ? "L:CRS_SEL_2" : "L:CRS_SEL";
                    SimVar.SetSimVarValue(navObsVar, "Number", newCrs);
                    if (delta > 0) SimVar.SetSimVarValue("K:VOR1_OBI_INC", "number", 1);
                    else if (delta < 0) SimVar.SetSimVarValue("K:VOR1_OBI_DEC", "number", 1);
                }
                window.testCrs = newCrs;
            }
        } else if (size === "large") {
            if (delta > 0) this.nextPage(); // Clockwise rotation.
            else if (delta < 0) this.previousPage(); // Counterclockwise rotation.
        }
        // Large knob delta (future: page, menu, etc)
        this.Update();
    }

    nextPage() {
        const currentIndex = this.pages.indexOf(this.currentPage);
        // Only advance if not at the last page
        if (currentIndex < this.pages.length - 1) {
            this.currentPage = this.pages[currentIndex + 1];
        }
        this.Update();
    }

    previousPage() {
        const currentIndex = this.pages.indexOf(this.currentPage);
        // Only go back if not at the first page
        if (currentIndex > 0) {
            this.currentPage = this.pages[currentIndex - 1];
        }
        this.Update();
    }

    // --- Unified Button Press Logic (short press: reserved for menu) ---
    handleKnobShortPress() {
        // TODO: Implement menu/options handler here in future
    }

    // --- Unified SYNC LOGIC (track/course, raw data) ---
    handleKnobSyncRaw() {
        if (this.activeBox === "trk") {
            this.trkSel = this.heading;
            if (typeof SimVar !== "undefined") {
                SimVar.SetSimVarValue("L:TRK_SEL", "Number", this.trkSel);
            }
        } else if (this.activeBox === "crs") {
            if (this.selectedNavSource === "GPS") {
                this.crsSel = this.heading;
                if (typeof SimVar !== "undefined") {
                    SimVar.SetSimVarValue("L:CRS_SEL", "Number", this.crsSel);
                }
            } else if (this.selectedNavSource === "VOR1" || this.selectedNavSource === "VOR2") {
                this.centerVORCourseToStation();
            }
        }
    }

    cycleNavSource() {
        if (this.selectedNavSource === "GPS") {
            this.selectedNavSource = "VOR1";
            SimVar.SetSimVarValue("GPS DRIVES NAV1", "Bool", 0);
        } else {
            this.selectedNavSource = "GPS";
            SimVar.SetSimVarValue("GPS DRIVES NAV1", "Bool", 1);
        }
        this.Update();
    }

    centerVORCourseToStation() {
        let heading = this.heading;
        if (this.selectedNavSource === "VOR1") {
            const relBearingRad = Number(SimVar.GetSimVarValue("NAV RELATIVE BEARING TO STATION:1", "radians")) || 0;
            const relBearingDeg = relBearingRad * (180 / Math.PI);
            const desiredCourse = ((heading + relBearingDeg + 360) % 360);
            this.crsSel = desiredCourse;
            SimVar.SetSimVarValue("L:CRS_SEL", "Number", desiredCourse);
            SimVar.SetSimVarValue("K:VOR1_SET", "number", Math.round(desiredCourse));
        } else if (this.selectedNavSource === "VOR2") {
            const relBearingRad = Number(SimVar.GetSimVarValue("NAV RELATIVE BEARING TO STATION:2", "radians")) || 0;
            const relBearingDeg = relBearingRad * (180 / Math.PI);
            const desiredCourse = ((heading + relBearingDeg + 360) % 360);
            this.crsSel = desiredCourse;
            SimVar.SetSimVarValue("L:CRS_SEL_2", "Number", desiredCourse);
            SimVar.SetSimVarValue("K:VOR2_SET", "number", Math.round(desiredCourse));
        }
        this.Update();
    }


    drawCompassCard(ctx, cx, cy, R) {
        const img = this.images.compassImg;
        ctx.save();
        ctx.translate(cx, cy);
        //ctx.rotate(-this.heading * Math.PI / 180);
        ctx.rotate(-this.trackMag * Math.PI / 180);
        if (img && img.complete && img.naturalWidth > 0)
            ctx.drawImage(img, -R, -R, R * 2, R * 2);
        ctx.restore();
    }
    drawHSILayer2(ctx, cx, cy, R) {
        const img = this.images.hsiLayer2Img;
        if (img && img.complete && img.naturalWidth > 0) {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.drawImage(img, -R, -R, R * 2, R * 2);
            ctx.restore();
        }
    }
    drawBug(ctx, cx, cy, R) {
        const img = this.images.bugImg;
        let angle = (this.trkSel - this.heading) * Math.PI / 180;
        let bugRadius = R - 2;
        let x = cx + bugRadius * Math.sin(angle);
        let y = cy - bugRadius * Math.cos(angle);
        if (img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle);
            ctx.drawImage(img, -12, -12, 24, 24);
            ctx.restore();
        }
    }
    // this draws the degree symbol used in heading and course boxes
    drawDegreeSymbol(ctx, x, y, radius = 3) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = "#fff"; // you can change the color if needed
        ctx.globalAlpha = 0.85; // slightly faded, optional
        ctx.fill();
        ctx.restore();
    }

    drawHeadingBox(ctx, cx) {
        const boxW = 30, boxH = 36, boxY = 60;
        ctx.save();
        ctx.font = "bold 16px Arial";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const txt = Math.round(this.heading).toString().padStart(3, "0");
        ctx.fillText(txt, cx, boxY + (boxH / 2) - 1);

        // Draw degree symbol (small circle) to upper right of the text
        let txtMetrics = ctx.measureText(txt);
        let degreeRadius = 3; // You can make this bigger/smaller
        let degreeX = cx + (txtMetrics.width / 2) + degreeRadius + 2; // +2px spacing from text
        let degreeY = boxY + (boxH / 2) - 8; // Higher than text, -8 for good effect

        this.drawDegreeSymbol(ctx, degreeX, degreeY, degreeRadius);

        ctx.restore();
    }

    drawDegreeSymbol(ctx, x, y, radius = 2.2) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = "#fff";
        ctx.fill();
        ctx.restore();
    }

    drawTrackAnnunciation(ctx) {
        if (!ctx || !this.canvas) return;

        const canvasW = this.canvas.width;
        const canvasH = this.canvas.height;

        // Top area geometry
        const pointerX = Math.round(canvasW / 2) + 0;
        const tapeTop = canvasH - 225;
        const tapeHeight = 22;

        const trackCenter = Math.round(this.trackMag || 0) % 360;
        const trkText = (trackCenter === 0 ? "360" : String(trackCenter).padStart(3, "0"));

        // Measure numeric text width using the same font we'll draw with
        ctx.save();
        ctx.font = "bold 20px Arial";
        const txtW = ctx.measureText(trkText).width;
        ctx.restore();

        // numeric bg geometry
        const bgW = txtW + 12, bgH = 24;
        const bgX = pointerX - bgW / 2, bgY = tapeTop - bgH - 6;

        // LEFT small TRK box placed to the left of the numeric background
        const trkBoxW = 30, trkBoxH = 16;
        const gap = -2; // negative gap to slightly overlap
        const trkBoxX = bgX - trkBoxW - gap;
        const trkBoxY = Math.round(bgY + (bgH - trkBoxH) / 2) + 4;

        // --- Draw TRK box first (so numeric bg drawn afterwards can cover part of it) ---
        ctx.save();
        ctx.fillStyle = "#000";
        ctx.fillRect(trkBoxX, trkBoxY, trkBoxW, trkBoxH);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "#fff";
        ctx.strokeRect(trkBoxX, trkBoxY, trkBoxW, trkBoxH);
        ctx.font = "10px Arial";
        ctx.fillStyle = "#26c6ff"; // light blue
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("TRK", trkBoxX + trkBoxW / 2, trkBoxY + trkBoxH / 2 + 1);
        ctx.restore();

        // --- Draw numeric background box (black w/ white border) overlapping TRK box ---
        ctx.save();
        ctx.fillStyle = "#000";
        ctx.fillRect(bgX, bgY, bgW, bgH);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "#fff";
        ctx.strokeRect(bgX, bgY, bgW, bgH);

        // Draw magenta TRK numeric (without degree symbol) centered, then draw degree symbol
        ctx.font = "bold 20px Arial";
        ctx.fillStyle = "#ff00ff"; // magenta
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const textY = bgY + bgH / 2 + 1;
        ctx.fillText(trkText, pointerX-5, textY);

        // Degree symbol drawn using drawDegreeSymbol to match TRK/CRS boxes
        // Position it slightly to the right of the numeric text
        const degX = pointerX + (txtW / 2) + 5;
        const degY = textY - 8;
        this.drawDegreeSymbol(ctx, degX-5, degY, 3);

        ctx.restore();
    }

    drawTrackBox(ctx, cx, cy, R) {
        const boxW = 35, boxH = 25, boxX = cx - 65, boxY = cy + 64;
        ctx.save();
        ctx.beginPath();
        ctx.rect(boxX, boxY, boxW, boxH);
        ctx.lineWidth = 3;
        ctx.strokeStyle = this.activeBox === "trk" ? "#00eaff" : "#225";
        ctx.stroke();
        ctx.font = "bold 14px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#26c6ff"; // light blue
        const txt = Math.round(this.trkSel).toString().padStart(3, "0");
        // Text position
        const txtX = (boxX + boxW / 2) - 3;
        const txtY = 8 + boxY + boxH / 2;
        ctx.fillText(txt, txtX, txtY);
        // Draw degree symbol: upper right of text
        let txtMetrics = ctx.measureText(txt);
        let degX = txtX + (txtMetrics.width / 2) + 5;
        let degY = txtY - 7;
        this.drawDegreeSymbol(ctx, degX, degY, 3);
        ctx.restore();
    }

    drawCrsBox(ctx, cx, cy, R) {
        const boxW = 35, boxH = 25, boxX = cx + 33, boxY = cy + 64;
        ctx.save();
        ctx.beginPath();
        ctx.rect(boxX, boxY, boxW, boxH);
        ctx.lineWidth = 3;
        let isActive = this.activeBox === "crs";
        let crsTextColor = (this.selectedNavSource === "GPS") ? "#e049b0" : "#00ff00";
        ctx.strokeStyle = isActive ? "#00eaff" : "#225";
        ctx.stroke();
        ctx.font = "bold 14px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = crsTextColor;
        const txt = Math.round(this.crsSel).toString().padStart(3, "0");
        // Text position
        const txtX = (boxX + boxW / 2) - 3;
        const txtY = 8 + boxY + boxH / 2;
        ctx.fillText(txt, txtX, txtY);
        // Draw degree symbol: upper right of text
        let txtMetrics = ctx.measureText(txt);
        let degX = txtX + (txtMetrics.width / 2) + 5;
        let degY = txtY - 7;
        this.drawDegreeSymbol(ctx, degX, degY, 3);
        ctx.restore();
    }

    drawCourseNeedleAndCDI(ctx, cx, cy, R) {
        if (this.cdiNeedleValid) {
            // Defensive: sanitize inputs!
            const course = Number.isFinite(this.courseToDraw) ? this.courseToDraw : 0;
            const heading = Number.isFinite(this.heading) ? this.heading : 0;
            // Defensive fallback: treat non-finite as 0 always
            const cdiRaw = Number.isFinite(this.cdiDeflection) ? this.cdiDeflection : 0;
            const courseColor = (this.selectedNavSource === "GPS") ? "#e049b0" : "#00ff00";
            const needleWidth = 4, needleLen = R * 0.95;
            const gapRadius = R * 0.4, gapPx = R * 0.15;
            const cdiMaxDots = 2, cdiDotSpacing = R * 0.19;
            const cdiLen = gapPx * 3.5, dotsRadius = 6;
            const toFromFlag = this.toFromFlag;

            // Rotation angles
            let angleRad = (course - heading) * Math.PI / 180;
            let perpRad = angleRad + Math.PI / 2;

            // --- Course needle pointer
            const xTip = cx + needleLen * Math.sin(angleRad);
            const yTip = cy - needleLen * Math.cos(angleRad);
            const xGapTop = cx + (gapRadius + gapPx / 2) * Math.sin(angleRad);
            const yGapTop = cy - (gapRadius + gapPx / 2) * Math.cos(angleRad);
            const xBase = cx - needleLen * Math.sin(angleRad);
            const yBase = cy + needleLen * Math.cos(angleRad);
            const xGapBottom = cx - (gapRadius + gapPx / 2) * Math.sin(angleRad);
            const yGapBottom = cy + (gapRadius + gapPx / 2) * Math.cos(angleRad);

            ctx.save();
            ctx.strokeStyle = courseColor;
            ctx.lineWidth = needleWidth;
            ctx.beginPath();
            ctx.moveTo(xTip, yTip);
            ctx.lineTo(xGapTop, yGapTop);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(xBase, yBase);
            ctx.lineTo(xGapBottom, yGapBottom);
            ctx.stroke();
            ctx.restore();

            // --- CDI Bar (centers when deviation==0, always rotates with course)
            let cdiNorm = Math.max(-127, Math.min(127, cdiRaw)) / 127 * cdiMaxDots;
            const cdiCX = cx + cdiNorm * cdiDotSpacing * Math.sin(perpRad);
            const cdiCY = cy - cdiNorm * cdiDotSpacing * Math.cos(perpRad);

            const cdiX1 = cdiCX - cdiLen / 2 * Math.sin(angleRad);
            const cdiY1 = cdiCY + cdiLen / 2 * Math.cos(angleRad);
            const cdiX2 = cdiCX + cdiLen / 2 * Math.sin(angleRad);
            const cdiY2 = cdiCY - cdiLen / 2 * Math.cos(angleRad);

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(cdiX1, cdiY1);
            ctx.lineTo(cdiX2, cdiY2);
            ctx.strokeStyle = courseColor;
            ctx.lineWidth = needleWidth;
            ctx.lineCap = "round";
            ctx.globalAlpha = 0.98;
            ctx.stroke();
            ctx.restore();

            // --- CDI dots (fixed locations; dot bar perpendicular to pointer)
            ctx.save();
            for (let i = -cdiMaxDots; i <= cdiMaxDots; i++) {
                if (i === 0) continue;
                const dotX = cx + i * cdiDotSpacing * Math.sin(perpRad);
                const dotY = cy - i * cdiDotSpacing * Math.cos(perpRad);
                ctx.beginPath();
                ctx.arc(dotX, dotY, dotsRadius, 0, Math.PI * 2);
                ctx.globalAlpha = 1.0;
                ctx.strokeStyle = "#fff";
                ctx.lineWidth = 3.0;
                ctx.stroke();
            }
            ctx.restore();

            // --- Needle tip and TO/FROM triangles
            this.drawNeedleTriangle(ctx, cx, cy, angleRad, needleLen, needleWidth * 5, courseColor, 8);
            if (toFromFlag < 2) {
                this.drawNeedleTriangle(ctx, cx, cy, angleRad, needleLen * 0.45, needleWidth * 6, courseColor, 15);
            } else {
                this.drawNeedleTriangle(ctx, cx, cy, angleRad, needleLen * -0.45, needleWidth * 6, courseColor, 15, true);
            }
        }
        
    }

    drawNeedleTriangle(ctx, cx, cy, angleRad, radius, triWidth, color, triLen = 10, flip = false) {
        const perpRad = angleRad + Math.PI / 2;
        const tipR = flip ? radius : radius;
        const baseR = flip ? radius + triLen : radius - triLen;
        const tipX = cx + tipR * Math.sin(angleRad);
        const tipY = cy - tipR * Math.cos(angleRad);
        const baseX = cx + baseR * Math.sin(angleRad);
        const baseY = cy - baseR * Math.cos(angleRad);

        const base1X = baseX - triWidth / 2 * Math.sin(perpRad);
        const base1Y = baseY + triWidth / 2 * Math.cos(perpRad);
        const base2X = baseX + triWidth / 2 * Math.sin(perpRad);
        const base2Y = baseY - triWidth / 2 * Math.cos(perpRad);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(base1X, base1Y);
        ctx.lineTo(base2X, base2Y);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.2;
        ctx.globalAlpha = 1.0;
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    drawNavSource(ctx, cx, cy, R) {
        // Instead of selectedNavSource, show navSourceText which can be ILS1, LOC1, VOR1, GPS, etc
        let navSourceText = this.navSourceText || this.selectedNavSource;
        let navSourceColor = (navSourceText === "GPS") ? "#e049b0" : "#00ff00";
        ctx.save();
        ctx.font = "bold 14px Arial";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillStyle = navSourceColor;
        ctx.shadowColor = "black"; ctx.shadowBlur = 4;
        ctx.fillText(navSourceText, cx - R * 0.50, cy - R * 0.30);

        // --- Phase text ---
        ctx.font = "bold 14px Arial";
        ctx.textAlign = "left";
        ctx.fillStyle = (navSourceText === "GPS") ? "#e049b0" : "#00ff00";
        ctx.fillText(this.phaseText, cx + R * 0.30, cy - R * 0.30);
        ctx.restore();
    }

    drawObsText(ctx, cx, cy, R) {
        if (this.selectedNavSource === "GPS" && this.gpsObsActive) {
            ctx.save();
            ctx.font = "bold 16px Arial";
            ctx.textAlign = "right";
            ctx.textBaseline = "bottom";
            ctx.fillStyle = "#e049b0";
            ctx.shadowColor = "black";
            ctx.shadowBlur = 4;
            ctx.fillText("OBS", cx + R * 0.5, cy + R * .17);//0.33);
            ctx.restore();
        }
    }

    drawCenterAirplane(ctx, cx, cy) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2.2;
        ctx.globalAlpha = 1.0;
        ctx.beginPath();
        ctx.moveTo(0, -17); ctx.lineTo(0, +17);
        ctx.moveTo(-14, 0); ctx.lineTo(+14, 0);
        ctx.moveTo(-7, +11); ctx.lineTo(+7, +11);
        ctx.stroke();
        ctx.beginPath(); ctx.arc(0, -16, 2.5, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill();
        ctx.restore();
    }

    drawWaypointIdent(ctx, cx, cy, R) {
        if (!this.waypointIdent) return;
        ctx.save();
        ctx.font = "nold 14px Arial";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillStyle = this.identColor;
        ctx.shadowColor = "black";
        ctx.shadowBlur = 4;
        const identX = cx - R * 0.6;
        const identY = cy + R * 0.1;
        ctx.fillText(this.waypointIdent, identX, identY - 5);
        ctx.restore();
    }

    drawBezel(ctx, w, h) {
        ctx.save();
        ctx.drawImage(this.images.bezelImg, 0, 0, w, h);
        ctx.restore();
    }

    drawDisEte(ctx, cx, cy, R) {
        ctx.save();
        ctx.font = "bold 14px Arial";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        const disLabelX = cx - R * 0.6;
        const disLabelY = cy + R * 0.2;

        let distance = parseFloat(this.distanceToNext);
        // Clamp tiny negatives to zero
        if (isNaN(distance) || this.distanceToNext === "") {
            distance = "";
        } else if (Math.abs(distance) < 0.05) {
            distance = 0.0;
        }
        let disStr = distance !== "" ? distance.toFixed(1) : "";

        ctx.fillStyle = "#26c6ff"; // light blue
        ctx.fillText("DIS:", disLabelX, disLabelY);
        ctx.fillStyle = this.identColor;
        ctx.fillText(disStr + "NM", disLabelX + 30, disLabelY);

        ctx.fillStyle = "#26c6ff"; // light blue
        ctx.textAlign = "right";
        const eteLabelX = cx + R * 0.3;
        ctx.fillText("ETE:", eteLabelX, disLabelY);
        ctx.fillStyle = this.identColor;
        ctx.fillText(this.eteToNextStr, eteLabelX + 40, disLabelY);
        ctx.restore();
    }

    drawVerticalGuidance(ctx, cx, cy, R) {
        // Only draw vertical guidance if signal is valid and type is set
        if (!this.vtgValid || !this.vtgType) return;
        if (this.vtgType === "GP" && this.selectedNavSource !== "GPS") return;
        if (this.vtgType === "GS" && !(this.selectedNavSource === "VOR1" || this.selectedNavSource === "VOR2")) return;
        if (this.vtgType === "VNAV" && this.selectedNavSource !== "GPS") return;

        // Tape geometry (right edge of HSI, does not overlap needles)
        const tapeWidth = 16;
        const tapeHeight = R * 1.18;
        const tapeX = cx + R * 0.6;
        const tapeY = cy - tapeHeight / 2 - 2;

        // If you have a vertical bar PNG, draw here (optional)
        const img = this.images.cdiVertImg;
        if (img && img.complete && img.naturalWidth > 0)
            ctx.drawImage(img, tapeX, tapeY, tapeWidth, tapeHeight);

        // Draw source type letter (G for GS/GP, V for VNAV)
        let vertColor = "#00ff00", topChar = "G";
        if (this.vtgType === "GS") { vertColor = "#00ff00"; topChar = "G"; }
        else if (this.vtgType === "GP") { vertColor = "#e049b0"; topChar = "G"; }
        else if (this.vtgType === "VNAV") { vertColor = "#e049b0"; topChar = "V"; }
        ctx.save();
        ctx.font = "bold 15px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = vertColor;
        ctx.shadowColor = "black";
        ctx.shadowBlur = 4;
        ctx.fillText(topChar, tapeX + tapeWidth / 2, tapeY + 5);
        ctx.restore();

        // --- Calculate marker position (digital deviation indicator) ---
        const dotsTotal = 2.2;
        const dotSpacing = tapeHeight / 6;
        // Clamp and normalize vtgDeflection from [-127,+127] to [-2,+2]
        let defl = Math.max(-127, Math.min(127, this.vtgDeflection)) / 127 * dotsTotal;
        defl = Math.max(-dotsTotal, Math.min(dotsTotal, defl)); // clamp again for safety

        // --- Vertical fine-tune offset for visual centering ---
        const verticalFineTune = 12; // Pixels (increase if diamond is too high, decrease if too low)

        let markerY = tapeY + tapeHeight / 2 + defl * dotSpacing + verticalFineTune;

        // Draw marker
        ctx.save();
        ctx.translate(tapeX + tapeWidth / 2, markerY);

        if (this.vtgType === "GS" || this.vtgType === "GP") {
            // Diamond for GS (green) or GP (magenta)
            ctx.beginPath();
            ctx.moveTo(0, -7);
            ctx.lineTo(7, 0);
            ctx.lineTo(0, 7);
            ctx.lineTo(-7, 0);
            ctx.closePath();
            ctx.fillStyle = vertColor;
            ctx.strokeStyle = "#222";
            ctx.lineWidth = 2;
            ctx.fill();
            ctx.stroke();
        } else if (this.vtgType === "VNAV") {
            // Left-pointing magenta "V"
            ctx.beginPath();
            ctx.moveTo(-10, 0);
            ctx.lineTo(0, -9);
            ctx.lineTo(0, 9);
            ctx.closePath();
            ctx.fillStyle = "#e049b0";
            ctx.strokeStyle = "#222";
            ctx.lineWidth = 2;
            ctx.fill();
            ctx.stroke();
        }
        ctx.restore();
    }

    followTRK() {
        if (this.trkHold) {
            let drift = this.heading - this.groundTrack; // positive if crab left, negative if right
            // Normalize to [-180,180] to handle wrap
            if (drift < -180) drift += 360;
            if (drift > 180) drift -= 360;
            // Heading bug should be set to (target track + drift)
            let commandedHeading = (this.trkSel + drift + 360) % 360;
            // Only update if bug differs enough (avoid jitter)
            if (Math.abs(this.hdgSel - commandedHeading) > 0.5) {
                SimVar.SetSimVarValue("K:HEADING_BUG_SET", "number", Math.round(commandedHeading));
            }
        }
    }

    drawTouchBoxes(ctx, onlyKnob = false) {
        // Visualize all touch boxes or only knob ones (index >= 3)
        for (let i = 0; i < this.touchBoxes.length; i++) {
            if (onlyKnob && i < 3) continue;
            let box = this.touchBoxes[i];
            ctx.save();
            ctx.globalAlpha = 0.25;
            ctx.strokeStyle = "#29f";                     // Bold blue outline
            ctx.fillStyle = "rgba(80,180,255,0.3)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.rect(box.x, box.y, box.w, box.h);
            ctx.stroke();
            ctx.globalAlpha = 0.11;
            ctx.fill();
            ctx.globalAlpha = 1.0;
            ctx.font = "10px Arial";
            ctx.fillStyle = "#222";
            ctx.fillText(box.id.replace(/_/g, " "), box.x + 2, box.y + box.h / 2);
            ctx.restore();
        }
    }

    drawDebugText(ctx) {
        ctx.save();
        ctx.font = "bold 20px Arial";
        ctx.fillStyle = "#3498db";
        ctx.fillText(this.heading.toString(), 50, 50);
        ctx.restore();
    }

    drawRMIneedles(ctx, cx, cy, R) {
        const needleColor = "#26c6ff";
        const heading = this.heading;

        const shaftLen = R * 0.95;
        const tailLen = R * 0.95;
        const shaftWidth = 1;
        const doubleSep = 8;

        // Bearing 1: Only if RMI1Source is not none/0
        if (this.RMI1Source && isFinite(this.bearing1)) {
            const bearing1 = this.bearing1;
            const bearingRel = ((bearing1 - heading + 360) % 360);
            const angleRad = (bearingRel - 90) * Math.PI / 180;

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(angleRad);

            // Single shaft
            ctx.beginPath();
            ctx.moveTo(-tailLen, 0);
            ctx.lineTo(shaftLen, 0);
            ctx.lineWidth = shaftWidth;
            ctx.strokeStyle = needleColor;
            ctx.globalAlpha = 1.0;
            ctx.stroke();

            // Arrow head (V)
            ctx.beginPath();
            ctx.moveTo(shaftLen, 0);
            ctx.lineTo(shaftLen - 16, -10);
            ctx.moveTo(shaftLen, 0);
            ctx.lineTo(shaftLen - 16, +10);
            ctx.lineWidth = shaftWidth - 1;
            ctx.strokeStyle = needleColor;
            ctx.stroke();

            ctx.restore();
        }

        // Bearing 2: Only if RMI2Source is not none/0
        if (this.RMI2Source && isFinite(this.bearing2)) {
            const bearing2 = this.bearing2;
            const bearingRel = ((bearing2 - heading + 360) % 360);
            const angleRad = (bearingRel - 90) * Math.PI / 180;

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(angleRad);

            // Double shaft
            ctx.beginPath();
            ctx.moveTo(-tailLen, -doubleSep / 2);
            ctx.lineTo(shaftLen, -doubleSep / 2);
            ctx.moveTo(-tailLen, +doubleSep / 2);
            ctx.lineTo(shaftLen, +doubleSep / 2);
            ctx.lineWidth = shaftWidth - 1;
            ctx.strokeStyle = needleColor;
            ctx.globalAlpha = 1.0;
            ctx.stroke();

            // Shared V arrowhead
            ctx.beginPath();
            ctx.moveTo(shaftLen, 0);
            ctx.lineTo(shaftLen - 16, -10);
            ctx.moveTo(shaftLen, 0);
            ctx.lineTo(shaftLen - 16, +10);
            ctx.lineWidth = shaftWidth - 1;
            ctx.strokeStyle = needleColor;
            ctx.stroke();

            ctx.restore();
        }

        // Draw circle mask
        const img = this.images.circle;
        if (img && img.complete && img.naturalWidth > 0) {
            const circleSize = R * 1.34;
            ctx.save();
            ctx.globalAlpha = 1.0;
            ctx.translate(cx, cy);
            ctx.drawImage(img, -circleSize / 2, -circleSize / 2, circleSize, circleSize);
            ctx.restore();
        }
    }

    drawRMISources(ctx, cx, cy, R) {
        // Box geometry
        const boxW = 40, boxH = 18;
        const boxColor = "#181818";
        const boxStroke = "#fff";
        const arrowColor = "#26c6ff";
        const arrowHeight = 10;
        const arrowX = 8;
        const arrowBaseY = 6;

        // --- Bearing 1 Source Box ---
        if (this.RMI1Source !== 0) {
            let bearing1SourceText = (this.RMI1Source === 1) ? "GPS" : "VOR1";
            const trkBoxX = cx - 57, trkBoxY = cy + 68;
            const bearing1BoxX = trkBoxX + boxW / 2 - 10;
            const bearing1BoxY = trkBoxY - boxH - 8 + 10;

            ctx.save();
            ctx.beginPath();
            ctx.rect(bearing1BoxX - boxW / 2, bearing1BoxY - boxH / 2, boxW, boxH);
            ctx.fillStyle = boxColor;
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = boxStroke;
            ctx.stroke();

            // Arrow
            ctx.save();
            ctx.translate(
                bearing1BoxX - boxW / 2 + arrowX,
                bearing1BoxY + arrowBaseY
            );
            ctx.beginPath();
            ctx.moveTo(0, 0); ctx.lineTo(0, -arrowHeight);
            ctx.lineWidth = 1;
            ctx.strokeStyle = arrowColor;
            ctx.stroke();
            // Arrow head (V)
            ctx.beginPath();
            ctx.moveTo(0, -arrowHeight);
            ctx.lineTo(-3, -arrowHeight + 4);
            ctx.moveTo(0, -arrowHeight);
            ctx.lineTo(+3, -arrowHeight + 4);
            ctx.lineWidth = 1;
            ctx.strokeStyle = arrowColor;
            ctx.stroke();
            ctx.restore();

            // Source label right of arrow
            ctx.font = "10px Arial";
            ctx.fillStyle = "#fff";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText(bearing1SourceText, bearing1BoxX - boxW / 2 + 12, bearing1BoxY);

            ctx.restore();
        }

        // --- Bearing 2 Source Box ---
        if (this.RMI2Source !== 0) {
            let bearing2SourceText = (this.RMI2Source === 1) ? "GPS" : "VOR2";
            const crsBoxX = cx + 18, crsBoxY = cy + 53;
            const bearing2BoxX = crsBoxX + boxW / 2 + 16;
            const bearing2BoxY = crsBoxY - boxH - 8 + 27;

            ctx.save();
            ctx.beginPath();
            ctx.rect(bearing2BoxX - boxW / 2, bearing2BoxY - boxH / 2, boxW, boxH);
            ctx.fillStyle = boxColor;
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = boxStroke;
            ctx.stroke();

            ctx.save();
            ctx.translate(
                bearing2BoxX - boxW / 2 + arrowX,
                bearing2BoxY + arrowBaseY
            );
            // Shaft 1
            ctx.beginPath();
            ctx.moveTo(-1, 0); ctx.lineTo(-1, -arrowHeight);
            ctx.lineWidth = 1;
            ctx.strokeStyle = arrowColor;
            ctx.stroke();
            // Shaft 2
            ctx.beginPath();
            ctx.moveTo(+1, 0); ctx.lineTo(+1, -arrowHeight);
            ctx.lineWidth = 1;
            ctx.strokeStyle = arrowColor;
            ctx.stroke();
            // Common arrow head (V)
            ctx.beginPath();
            ctx.moveTo(0, -arrowHeight);
            ctx.lineTo(-4, -arrowHeight + 7);
            ctx.moveTo(0, -arrowHeight);
            ctx.lineTo(+4, -arrowHeight + 7);
            ctx.lineWidth = 1;
            ctx.strokeStyle = arrowColor;
            ctx.stroke();
            ctx.restore();

            // Source label right of arrow
            ctx.font = "10px Arial";
            ctx.fillStyle = "#fff";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText(bearing2SourceText, bearing2BoxX - boxW / 2 + 12, bearing2BoxY);

            ctx.restore();
        }
    }

    // Draw TAS box: black box with white border, "TAS" label, TAS value and "MPH"
    drawTASBox(ctx) {
        if (!ctx || !this.canvas) return;

        const canvasW = this.canvas.width;
        const canvasH = this.canvas.height;

        // Geometry: adjust boxX/boxY to taste
        // This places the box on the left side, above the compass area used earlier.
        const tapeTop = canvasH - 200; // match vertical area used for TRK (same baseline)
        const boxW = 50;
        const boxH = 25;
        const boxX = 75;                       // left margin (adjust if you want it more centered)
        const boxY = tapeTop - boxH + 35;       // positioned above the TRK numeric area

        // Value text
        const valText = (typeof this.tasMph === "number" && isFinite(this.tasMph)) ? String(this.tasMph) : "---";

        // Draw box (black fill, white border)
        ctx.save();
        ctx.fillStyle = "#000";
        ctx.fillRect(boxX, boxY, boxW, boxH);
        ctx.strokeRect(boxX, boxY, boxW, boxH);

        // "TAS" label (white) at top-left inside box
        ctx.font = "10px Arial";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText("TAS", boxX + 15, boxY + 1);

        // TAS numeric (bigger) centered horizontally in the box, below label
        ctx.font = "14px Arial";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const numX = boxX + boxW / 2 - 14; // leave room for the "MPH" to the right
        const numY = boxY + (boxH / 2) + 4;
        ctx.fillText(valText, numX, numY);

        // "MPH" label small to the right of the number
        ctx.font = "10px Arial";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText("MPH", numX + 14, numY);

        ctx.restore();
    }

    drawPagingDots(ctx) {
        if (!ctx || !this.canvas) return;
        
        // Only draw dots if there are multiple pages
        if (this.pages.length <= 1) return;

        const canvasW = this.canvas.width;
        const dotRadius = 4;
        const dotSpacing = 14;
        const topMargin = 15;
        
        // Calculate total width needed for all dots
        const totalWidth = (this.pages.length - 1) * dotSpacing;
        const startX = (canvasW - totalWidth) / 2;
        
        // Get current page index
        const currentIndex = this.pages.indexOf(this.currentPage);
        
        ctx.save();
        
        // Draw each dot
        for (let i = 0; i < this.pages.length; i++) {
            const x = startX + i * dotSpacing;
            const y = topMargin;
            
            ctx.beginPath();
            ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
            
            // Active page: brighter white
            // Inactive pages: dim white
            if (i === currentIndex) {
                ctx.fillStyle = "#ffffff";
                ctx.globalAlpha = 1.0;
            } else {
                ctx.fillStyle = "#ffffff";
                ctx.globalAlpha = 0.3;
            }
            
            ctx.fill();
        }
        
        ctx.restore();
    }

    Update() {
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
            // Primary page rendering logic.
            this.drawCompassCard(ctx, cx, cy, R);
            this.drawRMIneedles(ctx, cx, cy, R);
            this.drawCourseNeedleAndCDI(ctx, cx, cy, R);
            this.drawVerticalGuidance(ctx, cx, cy, R);
            this.drawHSILayer2(ctx, cx, cy, R);
            this.drawNavSource(ctx, cx, cy, R);
            this.drawWaypointIdent(ctx, cx, cy, R);
            this.drawDisEte(ctx, cx, cy, R);
            this.drawCenterAirplane(ctx, cx, cy);
            this.drawBug(ctx, cx, cy, R);
            this.drawTrackAnnunciation(ctx);
            this.drawTrackBox(ctx, cx, cy, R);
            this.drawCrsBox(ctx, cx, cy, R);
            this.drawObsText(ctx, cx, cy, R);
        } else if (this.currentPage === "map") {
            // Map page rendering logic.
            this.drawCompassCard(ctx, cx, cy, R); // Map Page Compass.
            this.drawWaypointIdent(ctx, cx, cy, R); // Waypoint & Navigation Info.
            this.drawDisEte(ctx, cx, cy, R); // Distance and ETE for map.
            // You can add additional mock "map-related" drawing functions here.
        }

        this.drawBezel(ctx, w, h);
        this.drawPagingDots(ctx); // Draw paging status dots
        this.drawTouchBoxes(ctx, true); // Ensure touch boxes are drawn and selectable on both pages.
        this.drawTASBox(ctx); // Other universal functionality.
    }
}

if (typeof registerInstrument === "function") {
    registerInstrument("simple-glasscockpit-sample", MFD_screen);
}