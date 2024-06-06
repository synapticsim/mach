'use strict';
/* global BaseInstrument */
/* global registerInstrument */

class _MachInstrument_{{ templateId }} extends BaseInstrument {
    constructor() {
        super();
        let lastTime = this._lastTime;
        this.getDeltaTime = () => {
            const nowTime = Date.now();
            const deltaTime = nowTime - lastTime;
            lastTime = nowTime;
            return deltaTime;
        };
    }

    get templateID() {
        return '{{ templateId }}';
    }

    get isInteractive() {
        return true;
    }

    get IsGlassCockpit() {
        return true;
    }

    connectedCallback() {
        super.connectedCallback();
        Include.addScript("{{ jsPath }}");
    }

    Update() {
        super.Update();
        this.dispatchEvent(new CustomEvent("update", { detail: this.getDeltaTime() }));
    }

    onInteractionEvent(event) {
        const eventName = String(event);
        this.dispatchEvent(new CustomEvent(eventName));
        this.dispatchEvent(new CustomEvent("*", { detail: eventName }));
    }
}

registerInstrument("{{ instrumentName }}", _MachInstrument_{{ templateId }});
