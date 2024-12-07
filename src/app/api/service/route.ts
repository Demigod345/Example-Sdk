// @ts-ignore

import { NextResponse, NextRequest } from "next/server";
import { pinata } from "@/utils/config"

// export const config = {
//   api: {
//     bodyParser: false,
//   },
// };

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    console.log(data);
    const jsonBlob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const jsonFile = new File([jsonBlob], "data.json", { type: "application/json" });
    
    // const file: File | null = data.get("file") as unknown as File;
    const uploadData = await pinata.upload.file(jsonFile)
    console.log(uploadData)
    // const url = await pinata.gateways.convert(uploadData.IpfsHash)
    return NextResponse.json(uploadData.IpfsHash, { status: 200 });
  } catch (e) {
    console.log(e);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}