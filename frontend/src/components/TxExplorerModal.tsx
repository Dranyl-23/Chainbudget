import React, { useState, useEffect } from "react";
import { X, ExternalLink, Copy, CheckCircle2, Activity, Box, Clock, ShieldCheck, AlertCircle } from "lucide-react";
import { ethers } from "ethers";

interface TxExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  txHash: string;
}

interface TxData {
  status: "success" | "failed" | "pending";
  blockNumber?: number;
  timestamp?: string;
  from?: string;
  to?: string;
  gasFee?: string;
}

export default function TxExplorerModal({ isOpen, onClose, txHash }: TxExplorerModalProps) {
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [txData, setTxData] = useState<TxData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !txHash) return;

    let isMounted = true;
    setLoading(true);
    setError(null);
    setTxData(null);

    const fetchTxData = async () => {
      try {
        // Use a public Polygon Amoy RPC
        const provider = new ethers.JsonRpcProvider("https://rpc-amoy.polygon.technology");
        
        // Ensure we show the scanning animation for at least 1.5 seconds for the UX effect
        const minWait = new Promise((resolve) => setTimeout(resolve, 1500));
        
        const txPromise = provider.getTransaction(txHash);
        const receiptPromise = provider.getTransactionReceipt(txHash);
        
        const [_, tx, receipt] = await Promise.all([minWait, txPromise, receiptPromise]);

        if (!isMounted) return;

        if (!receipt || !tx) {
          // If receipt is null, it might still be pending or invalid
          setTxData({ status: "pending" });
          setLoading(false);
          return;
        }

        let timestampStr = "Unknown";
        if (receipt.blockNumber) {
          const block = await provider.getBlock(receipt.blockNumber);
          if (block) {
            timestampStr = new Date(block.timestamp * 1000).toLocaleString("en-US", {
              month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit"
            });
          }
        }

        // Calculate exact gas fee in MATIC
        let gasFeeInMatic = "0";
        if (receipt.gasUsed && tx.gasPrice) {
          const feeWei = receipt.gasUsed * tx.gasPrice;
          gasFeeInMatic = ethers.formatEther(feeWei);
        }

        setTxData({
          status: receipt.status === 1 ? "success" : "failed",
          blockNumber: receipt.blockNumber,
          timestamp: timestampStr,
          from: tx.from,
          to: tx.to || "Contract Creation",
          gasFee: parseFloat(gasFeeInMatic).toFixed(6),
        });
        setLoading(false);

      } catch (err) {
        console.error("Error fetching tx data:", err);
        if (isMounted) {
          setError("Failed to fetch live data. The RPC might be busy.");
          setLoading(false);
        }
      }
    };

    fetchTxData();

    return () => { isMounted = false; };
  }, [isOpen, txHash]);

  const handleCopy = () => {
    navigator.clipboard.writeText(txHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in"
      style={{ background: "rgba(11, 12, 16, 0.75)", backdropFilter: "blur(12px)" }}
    >
      <div className="absolute inset-0" onClick={onClose}></div>

      <div className="relative w-full max-w-lg glass rounded-2xl p-6 md:p-8 shadow-[0_0_40px_rgba(139,92,246,0.15)] border border-purple-500/30 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.2)]">
              <Activity className="w-5 h-5 text-purple-400 drop-shadow-[0_0_5px_rgba(168,85,247,0.8)]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white drop-shadow-sm">Blockchain Explorer</h2>
              <p className="text-xs text-purple-300/70 uppercase tracking-widest font-bold">Polygon Amoy Testnet</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 text-white/50 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="relative z-10">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="relative w-24 h-24 flex items-center justify-center mb-6">
                {/* Scanning Rings */}
                <div className="absolute inset-0 rounded-full border-2 border-dashed border-cyan-400/30 animate-[spin_4s_linear_infinite]"></div>
                <div className="absolute inset-2 rounded-full border-2 border-purple-500/40 animate-[spin_3s_linear_infinite_reverse]"></div>
                <div className="absolute inset-4 rounded-full bg-cyan-500/10 flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.3)]">
                  <Activity className="w-8 h-8 text-cyan-400 animate-pulse drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                </div>
              </div>
              <h3 className="text-lg font-bold text-white tracking-wider animate-pulse mb-2">SCANNING BLOCKCHAIN</h3>
              <p className="text-xs text-white/50 font-mono text-center">Fetching live data for<br/>{txHash.slice(0, 8)}...{txHash.slice(-8)}</p>
            </div>
          ) : error ? (
            <div className="py-8 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-red-400 mb-2">Connection Error</h3>
              <p className="text-sm text-white/60 mb-6">{error}</p>
              <button onClick={onClose} className="px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-bold text-white transition-colors">
                Close
              </button>
            </div>
          ) : txData ? (
            <div className="space-y-4">
              
              {/* Hash & Status Row */}
              <div className="p-4 rounded-xl bg-black/40 border border-white/5 shadow-inner">
                <div className="flex justify-between items-start mb-3">
                  <span className="text-xs font-bold text-white/50 uppercase tracking-widest">Transaction Hash</span>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border ${
                    txData.status === "success" ? "bg-green-500/10 text-green-400 border-green-500/30 shadow-[0_0_10px_rgba(74,222,128,0.1)]" :
                    txData.status === "failed" ? "bg-red-500/10 text-red-400 border-red-500/30" :
                    "bg-amber-500/10 text-amber-400 border-amber-500/30"
                  }`}>
                    {txData.status === "success" && <ShieldCheck className="w-3 h-3" />}
                    {txData.status === "pending" && <Clock className="w-3 h-3 animate-spin-slow" />}
                    {txData.status === "failed" && <AlertCircle className="w-3 h-3" />}
                    {txData.status}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-cyan-300 break-all">{txHash}</span>
                  <button onClick={handleCopy} className="p-1.5 rounded-md hover:bg-white/10 text-white/40 hover:text-white transition-colors shrink-0">
                    {copied ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {txData.status !== "pending" && (
                <>
                  {/* Grid Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/5 flex flex-col justify-center">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Box className="w-4 h-4 text-purple-400" />
                        <span className="text-xs font-bold text-white/50 uppercase tracking-widest">Block</span>
                      </div>
                      <span className="text-lg font-bold text-white">{txData.blockNumber}</span>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/5 flex flex-col justify-center">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Clock className="w-4 h-4 text-cyan-400" />
                        <span className="text-xs font-bold text-white/50 uppercase tracking-widest">Timestamp</span>
                      </div>
                      <span className="text-xs font-bold text-white/90 leading-tight">{txData.timestamp}</span>
                    </div>
                  </div>

                  {/* Gas & Addresses */}
                  <div className="space-y-3 p-4 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex justify-between items-center pb-3 border-b border-white/5">
                      <span className="text-xs font-bold text-white/50">Gas Fee</span>
                      <span className="text-sm font-bold text-purple-300">{txData.gasFee} MATIC</span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b border-white/5">
                      <span className="text-xs font-bold text-white/50">From</span>
                      <span className="text-xs font-mono text-white/80">{txData.from?.slice(0,6)}...{txData.from?.slice(-4)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-white/50">To</span>
                      <span className="text-xs font-mono text-white/80">{txData.to?.slice(0,6)}...{txData.to?.slice(-4)}</span>
                    </div>
                  </div>
                </>
              )}

              {/* Action */}
              <div className="mt-6">
                <a 
                  href={`https://amoy.polygonscan.com/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 rounded-xl text-sm font-bold text-white shadow-[0_0_20px_rgba(168,85,247,0.2)] transition-all"
                >
                  View on Polygonscan (Amoy) <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
