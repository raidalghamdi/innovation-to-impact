#!/usr/bin/env python3
"""Add new auth-flow translation keys to messages/ar.json and messages/en.json."""
import json
from collections import OrderedDict

EN_NEW = {
    "welcomeTitle": "Welcome",
    "welcomeSubtitle": "Enter your email to continue. We'll check your account and guide you to the next step.",
    "continue": "Continue",
    "backToEmail": "Use a different email",
    "lookupFailed": "We couldn't verify this email right now. Please try again.",
    "invalidEmail": "Please enter a valid email address.",

    "activateTitle": "Activate your account",
    "activateSubtitle": "Your email is registered. Set a password to activate your account for the first time.",
    "activateInfo": "This is the first time you sign in. Choose a strong password that meets the policy below.",
    "activateAndContinue": "Activate and continue",
    "activationFailed": "We couldn't activate your account. Please try again.",
    "alreadyActivated": "This account is already activated. Please sign in with your password.",

    "choosePassword": "Choose a password",
    "confirmPassword": "Confirm password",
    "passwordMismatch": "Passwords do not match.",
    "weakPassword": "Password doesn't meet the security policy.",

    "policyHint": "Password must be at least {min} characters and include uppercase, lowercase, a digit and a symbol.",
    "policyTooShort": "At least {min} characters",
    "policyNoUppercase": "One uppercase letter (A–Z)",
    "policyNoLowercase": "One lowercase letter (a–z)",
    "policyNoDigit": "One digit (0–9)",
    "policyNoSymbol": "One symbol (e.g. !@#$%)",

    "signupInfo": "This email is not registered yet. Complete your profile to create a new account.",
    "registerAndContinue": "Register and continue",
    "registrationFailed": "We couldn't complete your registration. Please try again.",
    "alreadyRegistered": "This email is already registered. Please sign in.",
}

AR_NEW = {
    "welcomeTitle": "أهلاً بك",
    "welcomeSubtitle": "أدخل بريدك الإلكتروني للمتابعة، وسنتحقق من حسابك ونوجهك للخطوة التالية.",
    "continue": "متابعة",
    "backToEmail": "استخدام بريد إلكتروني آخر",
    "lookupFailed": "تعذّر التحقق من البريد الإلكتروني الآن. يرجى المحاولة مرة أخرى.",
    "invalidEmail": "يرجى إدخال بريد إلكتروني صحيح.",

    "activateTitle": "تفعيل الحساب",
    "activateSubtitle": "بريدك الإلكتروني مسجّل. حدّد كلمة مرور لتفعيل حسابك لأول مرة.",
    "activateInfo": "هذه أول مرة تسجّل فيها الدخول. اختر كلمة مرور قوية تستوفي المتطلبات أدناه.",
    "activateAndContinue": "تفعيل ومتابعة",
    "activationFailed": "تعذّر تفعيل حسابك. يرجى المحاولة مرة أخرى.",
    "alreadyActivated": "هذا الحساب مفعّل مسبقاً. الرجاء تسجيل الدخول بكلمة المرور.",

    "choosePassword": "اختيار كلمة المرور",
    "confirmPassword": "تأكيد كلمة المرور",
    "passwordMismatch": "كلمتا المرور غير متطابقتين.",
    "weakPassword": "كلمة المرور لا تستوفي سياسة الأمان.",

    "policyHint": "يجب أن تكون كلمة المرور {min} خانة على الأقل وتشمل حرفاً كبيراً وصغيراً ورقماً ورمزاً.",
    "policyTooShort": "{min} خانة على الأقل",
    "policyNoUppercase": "حرف كبير واحد (A–Z)",
    "policyNoLowercase": "حرف صغير واحد (a–z)",
    "policyNoDigit": "رقم واحد (0–9)",
    "policyNoSymbol": "رمز واحد (مثل !@#$%)",

    "signupInfo": "هذا البريد الإلكتروني غير مسجّل بعد. أكمل بياناتك لإنشاء حساب جديد.",
    "registerAndContinue": "تسجيل ومتابعة",
    "registrationFailed": "تعذّر إتمام التسجيل. يرجى المحاولة مرة أخرى.",
    "alreadyRegistered": "هذا البريد الإلكتروني مسجّل مسبقاً. الرجاء تسجيل الدخول.",
}


def merge(path, additions):
    with open(path, encoding="utf-8") as f:
        data = json.load(f, object_pairs_hook=OrderedDict)
    auth = data.setdefault("auth", OrderedDict())
    added = []
    for k, v in additions.items():
        if k not in auth:
            auth[k] = v
            added.append(k)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"{path}: added {len(added)} keys → {added}")


merge("messages/en.json", EN_NEW)
merge("messages/ar.json", AR_NEW)
