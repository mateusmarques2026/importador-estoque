import { createRoot } from "react-dom/client";
import Inventory from "@/app/inventory";
import "@/app/globals.css";
import DemoToolbar from "./toolbar";
import { handleLinks, installDemoApi } from "./runtime";
import { handle, store } from "./api";
installDemoApi(handle);
handleLinks(() => {
  location.hash = "";
  location.reload();
});
createRoot(document.getElementById("root")!).render(
  <>
    <DemoToolbar
      repo="importador-estoque"
      onReset={() => {
        store.reset();
        location.reload();
      }}
    />
    <Inventory name="Marina · demonstração" email="marina@example.com" local />
  </>,
);
