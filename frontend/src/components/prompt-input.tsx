"use client";

import * as React from "react";
import { ArrowUpIcon, FileTextIcon, PlusIcon, XIcon } from "lucide-react";

import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";

export type AttachmentFile = {
  id: string;
  name: string;
};

interface PromptInputProps {
  text: string;
  files: AttachmentFile[];
  handleTextChange: (text: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onAttach: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

function PromptInput({
  files,
  handleTextChange,
  text,
  onAttach,
  onSubmit,
}: PromptInputProps) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const canSend = text.trim().length > 0;

  return (
    <div className="max-w-3xl mx-auto relative w-full py-4">
      <form ref={formRef} onSubmit={onSubmit} className="bg-input">
        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          tabIndex={-1}
          onChange={onAttach}
        />
        <InputGroup>
          {files.length > 0 && (
            <InputGroupAddon align="block-start" className="flex-wrap">
              {files.map((file) => (
                <Attachment key={file.id} size="sm">
                  <AttachmentMedia>
                    <FileTextIcon />
                  </AttachmentMedia>
                  <AttachmentContent>
                    <AttachmentTitle>{file.name}</AttachmentTitle>
                  </AttachmentContent>
                  <AttachmentActions>
                    <AttachmentAction
                      aria-label={`Remove ${file.name}`}
                      onClick={() => {
                        console.log(file);
                      }}
                    >
                      <XIcon />
                    </AttachmentAction>
                  </AttachmentActions>
                </Attachment>
              ))}
            </InputGroupAddon>
          )}
          <InputGroupTextarea
            value={text}
            onChange={(event) => handleTextChange(event.target.value)}
            placeholder="Message Expense GPT..."
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                formRef.current?.requestSubmit();
              }
            }}
            className="p-3 max-h-32"
          />
          <InputGroupAddon align="block-end" className="justify-between">
            <InputGroupButton
              size="icon-sm"
              variant="outline"
              className="rounded-full cursor-pointer"
              aria-label="Attach files"
              onClick={() => inputRef.current?.click()}
            >
              <PlusIcon />
            </InputGroupButton>

            <InputGroupButton
              type="submit"
              size="icon-sm"
              variant="default"
              className="rounded-full"
              disabled={!canSend}
              aria-label="Send"
            >
              <ArrowUpIcon />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </form>
    </div>
  );
}

export default PromptInput;
