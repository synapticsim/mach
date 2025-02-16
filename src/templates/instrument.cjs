'use strict';
/* global BaseInstrument */
/* global registerInstrument */

class _MachInstrument_{{ templateId }} extends BaseInstrument {
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
        document.dispatchEvent(new CustomEvent("update"));
    }

    onInteractionEvent(event) {
        document.dispatchEvent(new CustomEvent(event));
    }
}

registerInstrument("{{ instrumentName }}", _MachInstrument_{{ templateId }});
