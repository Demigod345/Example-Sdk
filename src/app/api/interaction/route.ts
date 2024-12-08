//@ts-nocheck

import { NextResponse } from 'next/server';
import { Mailchain } from '@mailchain/sdk';
import { ethers } from 'ethers';
import { EAS, SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import contractABI from "@/contract/abi.json"
import contractAddress from "@/contract/address.json"

// Constants
const EAS_CONTRACT_ADDRESS = "0x4200000000000000000000000000000000000021";
const SCHEMA_UID = "0x0353438abb8fc94491aa6c3629823c9ddcd0d7b28df6aa9a5281bbb5ff3bb6bb";
const RPC_URL = "https://sepolia.base.org";

// Environment variables
const MAILCHAIN_SECRET_RECOVERY_PHRASE = process.env.MAILCHAIN_SECRET_RECOVERY_PHRASE;
const SERVICE_ID = process.env.SERVICE_ID;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!MAILCHAIN_SECRET_RECOVERY_PHRASE) throw new Error("MAILCHAIN_SECRET_RECOVERY_PHRASE is not defined");
if (!SERVICE_ID) throw new Error("SERVICE_ID is not defined");
if (!PRIVATE_KEY) throw new Error("PRIVATE_KEY is not defined");



// Initialize clients
const mailchain = Mailchain.fromSecretRecoveryPhrase(MAILCHAIN_SECRET_RECOVERY_PHRASE);

interface EmailContent {
    serviceId: string;
    signerAddress: string;
    attestationUID: string;
}

function getHTMLContent(serviceId: string, signerAddress: string, uid: string): string {
    const magicLink = `https://core-two-smoky.vercel.app/feedback/${uid}`;
    
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

function getPlainTextContent({ serviceId, signerAddress, attestationUID }: EmailContent): string {
    const magicLink = `https://core-two-smoky.vercel.app/feedback/${attestationUID}`;
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

async function createAttestation(userAddress: string): Promise<string> {
    const contract = await getContract();
    if (!contract) {
        return null;
    }
    console.log("Here")
    const tx = await contract.attestInteraction(userAddress, BigInt(SERVICE_ID));
    const receipt = await tx.wait();

const newAttestationUID = await contract.getLastAttestation();

console.log("New attestation UID:", newAttestationUID);

return newAttestationUID;
}

async function sendEmail(to: string, emailContent: EmailContent): Promise<void> {
    const user = await mailchain.user();
    
    const { data, error } = await mailchain.sendMail({
        from: user.address,
        to: [to],
        subject: "Invitation to Provide Private Feedback - Rewards Available",
        content: {
            text: getPlainTextContent(emailContent),
            html: getHTMLContent(emailContent.serviceId, emailContent.signerAddress, emailContent.attestationUID),
        },
    });
    
    console.log("to: "+ to);
    
    if (error) {
        console.warn("Mailchain error", error);
        throw new Error("Failed to send email");
    }
    
    console.log("Email sent successfully:", data);
}

const getContract = async () => {
    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
        const contract = new ethers.Contract(
            contractAddress.address,
            contractABI,
            wallet
        )
        return contract;
    } catch (error) {
        toast.error("Failed to fetch contract: " + error.message)
        return null
    }
}

export async function POST(request: Request) {
    try {
        const { userAddress, signature, timestamp } = await request.json();

        if (!userAddress || !signature || !timestamp) {
            return NextResponse.json({ message: 'Missing data' }, { status: 400 });
        }

        // console.log({userAddress, signature, timestamp});

        const message = `Completing quiz interaction at timestamp: ${timestamp}`;
        const signer = ethers.verifyMessage(message, signature);
        if (signer !== userAddress) {
            return NextResponse.json({ message: 'Invalid signature' }, { status: 400 });
        }
        const attestationUID = await createAttestation(userAddress);

        const to = `${userAddress}@ethereum.mailchain.com`;
        const emailContent: EmailContent = {
            serviceId: SERVICE_ID,
            signerAddress: userAddress,
            attestationUID,
        };

        await sendEmail(to, emailContent);

        return NextResponse.json({ message: "Email sent successfully" }, { status: 200 });

    } catch (error) {
        console.error("Error in POST request:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}