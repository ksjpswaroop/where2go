// Default (typecheck/SSR) resolution. At runtime Metro picks SafeMap.native.tsx
// on iOS/Android and SafeMap.web.tsx on web via platform extensions, so
// react-native-maps is never bundled for web.
export { default } from "@/components/SafeMap.web";
