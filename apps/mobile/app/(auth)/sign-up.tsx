import { useAuth, useSSO, useSignUp } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import * as AuthSession from "expo-auth-session";
import { LinearGradient } from "expo-linear-gradient";
import { Link, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback } from "react";
import { Pressable, View } from "react-native";

import { Button, Field, IconCircle, Screen, Txt } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { useWarmUpBrowser } from "./sign-in";

WebBrowser.maybeCompleteAuthSession();

export default function SignUpScreen() {
  useWarmUpBrowser();
  const c = useColors();
  const router = useRouter();
  const { signUp, errors, fetchStatus } = useSignUp();
  const { isSignedIn } = useAuth();
  const { startSSOFlow } = useSSO();

  const [emailAddress, setEmailAddress] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [googleLoading, setGoogleLoading] = React.useState(false);

  const goHome = () => router.replace("/");

  const handleSubmit = async () => {
    const { error } = await signUp.password({ emailAddress, password });
    if (error) {
      console.error(JSON.stringify(error, null, 2));
      return;
    }
    await signUp.verifications.sendEmailCode();
  };

  const handleVerify = async () => {
    await signUp.verifications.verifyEmailCode({ code });
    if (signUp.status === "complete") {
      await signUp.finalize({
        navigate: ({ session }) => {
          if (session?.currentTask) return;
          goHome();
        },
      });
    } else {
      console.error("Sign-up attempt not complete:", signUp.status);
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

  if (signUp.status === "complete" || isSignedIn) {
    return null;
  }

  const awaitingCode =
    signUp.status === "missing_requirements" &&
    signUp.unverifiedFields.includes("email_address") &&
    signUp.missingFields.length === 0;

  if (awaitingCode) {
    return (
      <Screen>
        <View style={{ alignItems: "center", marginTop: 48, marginBottom: 28 }}>
          <IconCircle icon="mail-unread" color={c.primaryLight} bg={c.secondary} size={64} />
          <Txt weight="extrabold" size={26} style={{ marginTop: 16 }}>
            Verify your email
          </Txt>
          <Txt size={14} color={c.mutedForeground} style={{ marginTop: 8, textAlign: "center" }}>
            We sent a 6-digit code to {emailAddress}
          </Txt>
        </View>
        <View style={{ gap: 16 }}>
          <Field
            label="Verification code"
            keyboardType="numeric"
            value={code}
            onChangeText={setCode}
            placeholder="123456"
          />
          {errors.fields.code ? (
            <Txt size={13} color={c.destructive}>
              {errors.fields.code.message}
            </Txt>
          ) : null}
          <Button
            title="Verify & continue"
            icon="checkmark-circle-outline"
            onPress={handleVerify}
            loading={fetchStatus === "fetching"}
            disabled={!code}
          />
          <Button
            title="Send a new code"
            variant="ghost"
            onPress={() => signUp.verifications.sendEmailCode()}
          />
        </View>
      </Screen>
    );
  }

  const fieldError =
    errors.fields.emailAddress?.message || errors.fields.password?.message;

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
        <Txt weight="extrabold" size={28}>
          Create your account
        </Txt>
        <Txt size={15} color={c.mutedForeground} style={{ marginTop: 6 }}>
          Your safety net, always on.
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
          placeholder="Choose a strong password"
        />
        {fieldError ? (
          <Txt size={13} color={c.destructive}>
            {fieldError}
          </Txt>
        ) : null}
        <Button
          title="Sign up"
          icon="person-add-outline"
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
          Already have an account?{" "}
        </Txt>
        <Link href="/sign-in">
          <Txt size={14} weight="semibold" color={c.primaryLight}>
            Sign in
          </Txt>
        </Link>
      </View>

      <View nativeID="clerk-captcha" />
    </Screen>
  );
}
