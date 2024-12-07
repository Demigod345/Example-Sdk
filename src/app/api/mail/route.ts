import { NextResponse } from 'next/server';
import { Mailchain } from '@mailchain/sdk';
import { ethers } from 'ethers';
import { EAS, Attestation, SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import * as LitJsSdk from "@lit-protocol/lit-node-client";
import { LitNodeClient } from "@lit-protocol/lit-node-client";
import { LIT_NETWORK } from "@lit-protocol/constants";
import { encryptString } from "@lit-protocol/encryption";
// Constants
const EAS_CONTRACT_ADDRESS = "0x4200000000000000000000000000000000000021";
const SCHEMA_UID = "0x020a6948a237e5b85b335c12a53d992b8a9081838d6a65b741cb9fbb4e2fa16b";
const RPC_URL = "https://sepolia.base.org";

// Environment variables
const MAILCHAIN_SECRET_RECOVERY_PHRASE = process.env.MAILCHAIN_SECRET_RECOVERY_PHRASE;
const SERVICE_ID = process.env.SERVICE_ID;

if (!MAILCHAIN_SECRET_RECOVERY_PHRASE) throw new Error("MAILCHAIN_SECRET_RECOVERY_PHRASE is not defined");
if (!SERVICE_ID) throw new Error("SERVICE_ID is not defined");

// Initialize clients
const mailchain = Mailchain.fromSecretRecoveryPhrase(MAILCHAIN_SECRET_RECOVERY_PHRASE);
const litNodeClient = new LitNodeClient({
    litNetwork: LIT_NETWORK.DatilDev,
    debug: false,
});

// Types
interface EncryptionResult {
    ciphertext: string;
    dataToEncryptHash: string;
}

interface EmailContent {
    serviceId: string;
    signerAddress: string;
    ciphertext: string;
    dataToEncryptHash: string;
}

// Utility functions
function toUrlSafeBase64(base64String) {
    return base64String.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function getAccessControlConditions(address: string): object[] {
    return [
        {
            contractAddress: "",
            standardContractType: "",
            chain: "baseSepolia",
            method: "",
            parameters: [":userAddress"],
            returnValueTest: {
                comparator: "=",
                value: address,
            },
        },
    ];
}

function getHTMLContent({ serviceId, signerAddress, ciphertext, dataToEncryptHash }: EmailContent): string {
    const magicLink = `https://privacy-feedback.vercel.app/feedback/${ciphertext}/${dataToEncryptHash}`;
    
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>PrivateFeedback Invitation</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #1a1a1a;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <!-- Main Content Card -->
            <div style="background-color: #ffffff; border-radius: 8px; overflow: hidden; margin-top: 20px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                <div style="padding: 40px;">
                    <h1 style="color: #1a1a1a; font-family: Arial, sans-serif; font-size: 24px; font-weight: 600; text-align: center; margin: 0 0 30px 0;">
                        PrivateFeedback Invitation
                    </h1>

                    <p style="color: #2c3e50; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                        You've been invited to provide private feedback on a recent service interaction.
                    </p>

                    <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 15px; margin: 25px 0;">
                        <p style="color: #1a1a1a; font-family: Arial, sans-serif; font-size: 14px; margin: 0;">
                            Service ID: <strong>${serviceId}</strong><br>
                            Your Address: <strong>${signerAddress}</strong>
                        </p>
                    </div>

                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${magicLink}" style="display: inline-block; background-color: #3b82f6; color: #ffffff; font-family: Arial, sans-serif; font-size: 16px; font-weight: 600; text-decoration: none; padding: 12px 32px; border-radius: 6px;">
                            Submit Your Private Feedback
                        </a>
                    </div>

                    <p style="color: #475569; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; text-align: center; margin: 25px 0 0 0;">
                        Your privacy is our priority. All feedback is kept strictly confidential.
                    </p>
                </div>
            </div>

            <!-- Footer -->
            <div style="text-align: center; padding: 20px;">
                <p style="color: #94a3b8; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; margin: 0;">
                    Thank you for contributing to service improvement.<br>
                    Best regards,<br>
                    Team PrivateFeedback
                </p>
            </div>
        </div>
    </body>
    </html>`;
}

function getPlainTextContent({ serviceId, signerAddress, ciphertext, dataToEncryptHash }: EmailContent): string {
    const magicLink = `https://privacy-feedback.vercel.app/feedback/${ciphertext}/${dataToEncryptHash}`;
    return `PrivateFeedback Invitation

Hello,

You've been invited to provide private feedback on a recent service interaction. Your insights are valuable and could earn you rewards!

Service ID: ${serviceId}
Your Address: ${signerAddress}

To submit your private feedback, please visit the following link:
${magicLink}

Your privacy is our priority. All feedback is kept strictly confidential.

Thank you for contributing to service improvement.
Best regards,
Team PrivateFeedback`;
}

async function encrypt(AttestationUID: string, address: string): Promise<EncryptionResult> {
    await litNodeClient.connect();
  
    const accessControlConditions = getAccessControlConditions(address);
  
    const { ciphertext, dataToEncryptHash } = await encryptString(
      {
        accessControlConditions,
        chain: "baseSepolia",
        dataToEncrypt: AttestationUID,
      },
      litNodeClient
    );
  
    return { ciphertext, dataToEncryptHash };
}

async function getAttestation(AttestationUID: string): Promise<Attestation> {
    const eas = new EAS(EAS_CONTRACT_ADDRESS);
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    eas.connect(provider);
    const attestation = await eas.getAttestation(AttestationUID);
    
    if (!attestation) {
        throw new Error("Attestation not found");
    }
    
    return attestation;
}

async function sendEmail(to: string, emailContent: EmailContent): Promise<void> {
    const user = await mailchain.user();

    const { data, error } = await mailchain.sendMail({
        from: user.address,
        to: [to],
        subject: "Invitation to Provide Private Feedback - Rewards Available",
        content: {
            text: getPlainTextContent(emailContent),
            html: getHTMLContent(emailContent),
        },
    });

    if (error) {
        console.warn("Mailchain error", error);
        throw new Error("Failed to send email");
    }

    console.log("Email sent successfully:", data);
}

export async function POST(request: Request) {
    try {
        const { AttestationUID } = await request.json();

        if (!AttestationUID) {
            return NextResponse.json({ error: "Attestation UID is required" }, { status: 400 });
        }

        const attestation = await getAttestation(AttestationUID);
        const signerAddress = attestation.attester;

        const { ciphertext, dataToEncryptHash } = await encrypt(AttestationUID, signerAddress);

        const to = `${signerAddress}@ethereum.mailchain.com`;
        const urlSafeCiphertext = toUrlSafeBase64(ciphertext);
        const emailContent: EmailContent = {
            serviceId: BigInt(SERVICE_ID).toString(),
            signerAddress,
            ciphertext: urlSafeCiphertext,
            dataToEncryptHash
        };

        await sendEmail(to, emailContent);

        return NextResponse.json({ message: "Email sent successfully" }, { status: 200 });

    } catch (error) {
        console.error("Error in POST request:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}