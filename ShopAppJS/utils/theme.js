// utils/theme.js
import { Appearance } from "react-native";

/**
 * Dark = giống hệt Bảng điều khiển (galaxy blue đậm)
 * Light = xanh trời dịu để tương phản tốt
 */
const PALETTES = {
  dark: {
    // giữ đúng bộ màu đang dùng trên Dashboard (đẹp)
    gradient: ["#0b132b", "#202f5dff", "#3a506b"], // galaxy blue deep
    screenBg: "#131c3aff",
  },
  light: {
    gradient: ["#a1c4fd", "#c2e9fb"],           // sky blue
    screenBg: "#F8F9FA",
  },
};

export const resolveThemeMode = (t) =>
  t === "system" ? (Appearance.getColorScheme() || "light") : t;

export const getGradientColors = (themeMode) =>
  themeMode === "dark" ? PALETTES.dark.gradient : PALETTES.light.gradient;

export const getScreenBackground = (themeMode) =>
  themeMode === "dark" ? PALETTES.dark.screenBg : PALETTES.light.screenBg;
