// url=https://www.figma.com/design/roTSaBJuQTYNJpBInNahXQ/AIIBP-Design-System?node-id=5-9
// source=src/components/ui/Button.jsx
// component=Button
import figma from "figma";

const instance = figma.selectedInstance;
const label = instance.getString("Label");
const variant = instance.getEnum("Style", {
  Primary: "primary",
  Secondary: "secondary",
});

export default {
  example: figma.code`
    <Button variant={${variant}}>
      ${label}
    </Button>
  `,
  imports: ['import Button from "src/components/ui/Button.jsx"'],
  id: "aiibp-button",
};
