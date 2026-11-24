import os
import sys
import getpass
import pyotp
import httpx

print("=" * 60)
print("  AI TRADER — ANGEL ONE LIVE MARKET FEED SETUP")
print("  Strictly Paper Trading Mode (Zero Live Order Placement)")
print("=" * 60)

api_key = "1WBmDhSd"
print(f"\n[✓] Registered API Key: {api_key}")

client_code = input("\n1. Enter your Angel One Client Code (e.g., A12345 or M123456): ").strip()
pin = input("2. Enter your Angel One Trading PIN / MPIN: ").strip()
totp_secret = input("3. Enter your TOTP Secret Key (from SmartAPI > 'Enable TOTP'): ").strip().replace(" ", "").upper()

print("\nVerifying TOTP generation...")
try:
    current_totp = pyotp.TOTP(totp_secret).now()
    print(f"[✓] Generated current TOTP code: {current_totp}")
except Exception as e:
    print(f"[✗] Error: Invalid TOTP Secret key format: {e}")
    sys.exit(1)

print("\nConnecting to Angel One SmartAPI to test session generation...")
headers = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "X-UserType": "USER",
    "X-SourceID": "WEB",
    "X-ClientLocalIP": "127.0.0.1",
    "X-ClientPublicIP": "49.43.222.66",
    "X-MACAddress": "fe80::1",
    "X-PrivateKey": api_key
}

payload = {
    "clientcode": client_code,
    "password": pin,
    "totp": current_totp
}

try:
    with httpx.Client(timeout=15.0) as client:
        res = client.post(
            "https://apiconnect.angelone.in/rest/auth/angelbroking/user/v1/loginByPassword",
            json=payload,
            headers=headers
        )
        data = res.json()
        if data.get("status") and data.get("data", {}).get("jwtToken"):
            print("\n" + "=" * 60)
            print("  SUCCESS! Angel One SmartAPI Authentication Verified!")
            print(f"  Connected User: {data['data'].get('name', client_code)}")
            print("  Market Data Feed: AUTHORIZED (Live NSE/BSE/NFO Quotes)")
            print("  Execution Engine: VIRTUAL PAPER TRADING ONLY")
            print("=" * 60)

            # Save to .env
            env_content = f"""# AI TRADER LIVE CONFIGURATION
MARKET_DATA_PROVIDER=angel_one
ANGEL_API_KEY={api_key}
ANGEL_CLIENT_CODE={client_code}
ANGEL_PIN={pin}
ANGEL_TOTP_SECRET={totp_secret}
GATEWAY_SECRET=cf-gateway-verified-sec-883a9f
DATABASE_URL=sqlite:///./data/ai_trader.db
"""
            for path in [".env", "backend/.env"]:
                with open(path, "w", encoding="utf-8") as f:
                    f.write(env_content)
                print(f"[✓] Saved credentials to {path}")

            print("\nYour AI Trader platform is now configured for LIVE market data!")
        else:
            print(f"\n[✗] Login Failed from Angel One: {data.get('message', res.text)}")
            print("Please double check your Client Code, PIN, and TOTP Secret key.")
except Exception as e:
    print(f"\n[✗] Network/Connection error: {e}")
