"use client";

import { useState } from "react";
import { Ember } from "@/components/game/Ember";
import { useExplorer } from "@/components/guide/EmberGuide";

/** Home teaser: one switch, and Ember visibly changes. The flame drawing is an illustration. */
export function GravityTeaser() {
  const [on, setOn] = useState(true);
  const { discover } = useExplorer();
  return (
    <div className="flex flex-col items-center gap-4">
      <Ember form={on ? "earth" : "orbit"} mood={on ? "happy" : "surprised"} size={230} />
      <button
        role="switch"
        aria-checked={on}
        onClick={() => {
          setOn(!on);
          if (on) discover("gravity");
        }}
        className="teaser-switch"
      >
        <span className="teaser-track" aria-hidden="true">
          <span className="teaser-knob" />
        </span>
        Gravity {on ? "on" : "off"}
      </button>
      <div className="ember-bubble max-w-xs" aria-live="polite">
        <p className="text-[11px] font-semibold text-signal">Ember, your flame guide</p>
        <p className="mt-1">
          {on
            ? "On Earth hot air rises, so I stand tall. Flip the switch and take gravity away!"
            : "Whoa! Nothing rises in space, so I go round and blue. Now, what happens to a real fire?"}
        </p>
        <p className="mt-1 text-[11px] text-faint">Drawing, not a photo of a real flame.</p>
      </div>
    </div>
  );
}
