"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";

interface TruncatedDescriptionProps {
  description: string;
  maxLines?: number;
  className?: string;
}

export default function TruncatedDescription({
  description,
  maxLines = 3,
  className = "",
}: TruncatedDescriptionProps) {
  const [showModal, setShowModal] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = textRef.current;
    if (!element) return;
    const checkTruncation = () => {
      const shouldTruncate = element.scrollHeight > element.clientHeight + 1;
      setIsTruncated(shouldTruncate);
    };
    const raf = window.requestAnimationFrame(checkTruncation);
    return () => window.cancelAnimationFrame(raf);
  }, [description, maxLines]);

  if (!description) return null;

  return (
    <>
      <div className={className}>
        <div
          ref={textRef}
          className="whitespace-pre-wrap"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: maxLines,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {description}
        </div>
        {isTruncated && (
          <button
            onClick={() => setShowModal(true)}
            className="ml-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium underline"
          >
            Ver mais
          </button>
        )}
      </div>

      {/* Modal para descrição completa */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Descrição Completa"
      >
        <div className="p-6">
          <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap">
            {description}
          </div>
          <div className="flex justify-end mt-6">
            <Button
              onClick={() => setShowModal(false)}
              className="bg-zinc-500 hover:bg-zinc-600 text-white px-4 py-2"
            >
              Fechar
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
