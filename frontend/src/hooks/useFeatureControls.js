import { useContext } from "react";

import { FeatureControlContext } from "../context/FeatureControlContext.jsx";

export default function useFeatureControls() {
  return useContext(FeatureControlContext);
}
