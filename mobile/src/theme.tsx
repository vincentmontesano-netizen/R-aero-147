import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const palettes = {
  dark: {
    background: "#081421",
    card: "#122434",
    text: "#f1f5f9",
    muted: "#a6bac9",
    line: "#2c4152",
    gold: "#d2b166",
    buttonText: "#102237",
    success: "#7bd7b0",
    error: "#ffaaaa",
  },
  light: {
    background: "#f6f5ef",
    card: "#ffffff",
    text: "#102e46",
    muted: "#506778",
    line: "#d5dfe5",
    gold: "#b58b39",
    buttonText: "#102237",
    success: "#177952",
    error: "#b83232",
  },
};
type Mode = "light" | "dark";
const Context = createContext({
  mode: "dark" as Mode,
  colors: palettes.dark,
  setMode: (_mode: Mode) => {},
});
export const useTheme = () => useContext(Context);
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, update] = useState<Mode>(system === "light" ? "light" : "dark");
  useEffect(() => {
    void AsyncStorage.getItem("raero.theme")
      .then(value => {
        if (value === "dark" || value === "light") update(value);
      })
      .catch(() => {});
  }, []);
  const setMode = (value: Mode) => {
    update(value);
    void AsyncStorage.setItem("raero.theme", value).catch(() => {});
  };
  return (
    <Context.Provider value={{ mode, colors: palettes[mode], setMode }}>
      {children}
    </Context.Provider>
  );
}
