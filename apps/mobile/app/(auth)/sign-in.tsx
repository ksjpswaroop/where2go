import { useSSO, useSignIn } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import * as AuthSession from "expo-auth-session";
import { LinearGradient } from "expo-linear-gradient";
import { Link, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect } from "react";
import { Platform, Pressable, View } from "react-native";

import { Button, Field, IconCircle, Screen, Txt } from "@/components/ui";
import { useColors } from "@/hooks/useColors";

export const useWarmUpBrowser = () => {
  useEffect(() => {
    if (Platform.OS !== "android") return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
};

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  useWarmUpBrowser();
  const c = useColors();
  const router = useRouter();
  const { signIn, errors, fetchStatus } = useSignIn();
  const { startSSOFlow } = useSSO();

  const [emailAddress, setEmailAddress] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [googleLoading, setGoogleLoading] = React.useState(false);

  const goHome = () => router.replace("/");

  const handleSubmit = async () => {
    const { error } = await signIn.password({ emailAddress, password });
    if (error) {
      console.error(JSON.stringify(error, null, 2));
      return;
    }
    if (signIn.status === "complete") {
      await signIn.finalize({
        navigate: ({ session }) => {
          if (session?.currentTask) return;
          goHome();
        },
      });
    } else {
      console.error("Sign-in attempt not complete:", signIn.status);
    }
  };

  const handleGoogle = useCallback(async () => {
    try {
      setGoogleLoading(true);
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId && setActive) {
        await setActive({
          session: createdSessionId,
          navigate: async ({ session }) => {
            if (session?.currentTask) return;
            goHome();
          },
        });
      }
    } catch (err) {
      console.error(JSON.stringify(err, null, 2));
    } finally {
      setGoogleLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fieldError =
    errors.fields.identifier?.message || errors.fields.password?.message;

  return (
    <Screen>
      <View style={{ alignItems: "center", marginTop: 36, marginBottom: 28 }}>
        <LinearGradient
          colors={[c.primary, c.primaryLight]}
          style={{
            width: 76,
            height: 76,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 18,
          }}
        >
          <Ionicons name="shield-checkmark" size={40} color="#FFFFFF" />
        </LinearGradient>
        <Txt weight="extrabold" size={30}>
          SafeTrip
        </Txt>
        <Txt size={15} color={c.mutedForeground} style={{ marginTop: 6 }}>
          Travel solo. Never alone.
        </Txt>
      </View>

      <View style={{ gap: 16 }}>
        <Field
          label="Email address"
          autoCapitalize="none"
          keyboardType="email-address"
          value={emailAddress}
          onChangeText={setEmailAddress}
          placeholder="you@example.com"
        />
        <Field
          label="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholder="Your password"
        />
        {fieldError ? (
          <Txt size={13} color={c.destructive}>
            {fieldError}
          </Txt>
        ) : null}
        <Button
          title="Sign in"
          icon="log-in-outline"
          onPress={handleSubmit}
          loading={fetchStatus === "fetching"}
          disabled={!emailAddress || !password}
        />
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 22 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
        <Txt size={12} color={c.mutedForeground}>
          OR
        </Txt>
        <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
      </View>

      <Pressable
        onPress={handleGoogle}
        disabled={googleLoading}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          backgroundColor: c.secondary,
          borderRadius: c.radius,
          paddingVertical: 15,
          borderWidth: 1,
          borderColor: c.border,
          opacity: pressed || googleLoading ? 0.7 : 1,
        })}
      >
        <IconCircle icon="logo-google" color={c.foreground} bg="transparent" size={22} />
        <Txt weight="semibold" size={16}>
          Continue with Google
        </Txt>
      </Pressable>

      <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 28 }}>
        <Txt size={14} color={c.mutedForeground}>
          Don&apos;t have an account?{" "}
        </Txt>
        <Link href="/sign-up">
          <Txt size={14} weight="semibold" color={c.primaryLight}>
            Sign up
          </Txt>
        </Link>
      </View>
    </Screen>
  );
}
