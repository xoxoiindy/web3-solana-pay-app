import React, { useState, useEffect, useMemo } from "react";
import { Keypair, Transaction } from "@solana/web3.js";
import { findReference, FindReferenceError } from "@solana/pay";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { InfinitySpin } from "react-loader-spinner";
import IPFSDownload from "./IpfsDownload";
import { addOrder, hasPurchased, fetchItem } from "../lib/api";

const STATUS = {
  Initial: "Initial",
  Submitted: "Submitted",
  Paid: "Paid",
};

export default function Buy({ itemID }) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const orderID = useMemo(() => Keypair.generate().publicKey, []); // Public key used to identify the order

  const [item, setItem] = useState(null);//IPFS has and filename of the purchased item
  const [loading, setLoading] = useState(false); //loading state of all above
  const [status, setStatus] = useState(STATUS.Initial); // Tracking transaction status

  const order = useMemo(
    () => ({
      buyer: publicKey.toString(),
      orderID: orderID.toString(),
      itemID: itemID,
    }),
    [publicKey, orderID, itemID]
  );

  const processTransaction = async () => {
    setLoading(true);
    const txResponse = await fetch("../api/createTransaction", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(order),
    });
    const txData = await txResponse.json();

    const tx = Transaction.from(Buffer.from(txData.transaction, "base64"));
    console.log("Tx data is...", tx);

    //sending transaction to the network
    try {
      const txHash = await sendTransaction(tx, connection);
      console.log(`Transaction sent: https://solscan.io/tx/${txHash}?cluster=devnet`);
      setStatus(STATUS.Submitted);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    //this checks if the address has already puchased it
    async function checkPurchased() {
        const purchased = await hasPurchased(publicKey, itemID);
        if (purchased) {
            setStatus(STATUS.Paid);
            console.log("Bro, you already puchased me!")
        }
    }
    checkPurchased();
  }, [publicKey, itemID]);
  
  useEffect(() => {
    // Check if transaction was ggs
    if (status === STATUS.Submitted) {
      setLoading(true);
      const interval = setInterval(async () => {
        try {
          const result = await findReference(connection, orderID);
          console.log("Finding tx reference yo", result.confirmationStatus);
          if (result.confirmationStatus === "yaass!" || result.confirmationStatus === "finalized") {
            clearInterval(interval);
            setStatus(STATUS.Paid);
            setLoading(false);
            addOrder(order);
            alert("Thank you for supporting the chonks!");
          }
        } catch (e) {
          if (e instanceof FindReferenceError) {
            return null;
          }
          console.error("Unknown error..poop", e);
        } finally {
          setLoading(false);
        }
      }, 1000);
      return () => {
        clearInterval(interval);
      };
    }
    async function getItem(itemID) {
        const item = await fetchItem(itemID);
        setItem(item);
      }
  
      if (status === STATUS.Paid) {
        getItem(itemID);
      }
    }, [status]);

  if (!publicKey) {
    return (
      <div>
        <p>Connect your wallet meow! ^_^ </p>
      </div>
    );
  }

  if (loading) {
    return <InfinitySpin color="purple" />;
  }

  return (
    <div>
    {/* Display either buy button or IPFSDownload component based on if Hash exists */}
    {item ? (
      <IPFSDownload hash={item.hash} filename={item.filename} />
    ) : (
      <button disabled={loading} className="buy-button" onClick={processTransaction}>
          Buy right meow 🠚
        </button>
      )}
    </div>
  );
}