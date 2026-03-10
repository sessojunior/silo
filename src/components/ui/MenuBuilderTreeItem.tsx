import React, {
  forwardRef,
  HTMLAttributes,
  CSSProperties,
  memo,
  useCallback,
  useMemo,
  useState,
} from "react";
import classNames from "classnames";
import type { UniqueIdentifier } from "@dnd-kit/core";
import { AnimateLayoutChanges, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { TreeItemType, TreeItems, MenuItemData } from "./MenuBuilderTypes";

// Collapse Component - Memoizado para evitar re-renders
export const Collapse = memo(function Collapse(props: {
  open: boolean;
  handleOpen: (open: boolean) => void;
}) {
  const handleClick = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      props.handleOpen(!props.open);
    },
    [props],
  );

  return (
    <button
      onPointerDown={handleClick}
      className="flex items-center justify-center size-8 bg-transparent border-none rounded-full cursor-pointer transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-700/50"
      title={props.open ? "Recolher" : "Expandir"}
    >
      {!props.open ? (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-zinc-500 dark:text-zinc-400"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      ) : (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-zinc-500 dark:text-zinc-400"
          style={{ transform: "rotate(180deg)" }}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      )}
    </button>
  );
});

// TreeItem Props
export interface Props extends Omit<HTMLAttributes<HTMLLIElement>, "id"> {
  childCount?: number;
  clone?: boolean;
  collapsed?: boolean;
  depth: number;
  disableInteraction?: boolean;
  disableSelection?: boolean;
  ghost?: boolean;
  handleProps?: Record<string, unknown>;
  indicator?: boolean;
  indentationWidth: number;
  value: string;
  onCollapse?(): void;
  onRemove?(): void;
  onEdit?: (id: string, data: MenuItemData) => void;
  onDelete?: (id: string, data: MenuItemData) => void;
  wrapperRef?(node: HTMLLIElement): void;
  childs?: TreeItems;
  show?: string;
  updateitem?: (
    id: UniqueIdentifier,
    data: Omit<TreeItemType, "children">,
  ) => void;
  otherfields?: Record<string, unknown>;
}

// Recursive Item Component - Memoizado e otimizado
const RecursiveItem = memo(function RecursiveItem(props: {
  child: TreeItemType;
  nDepth: number;
}) {
  const newDepth = props.nDepth + 1;
  const marginLeft = useMemo(() => props.nDepth * 50, [props.nDepth]);

  const childItems = useMemo(
    () =>
      props.child.children.map((child: TreeItemType) => (
        <RecursiveItem
          key={child.id as string}
          child={child}
          nDepth={newDepth}
        />
      )),
    [props.child.children, newDepth],
  );

  return (
    <>
      <div
        className="w-full max-w-[414px] h-[42px] mt-1 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg flex items-center px-3 font-medium text-[14px] text-zinc-600 dark:text-zinc-400 select-none"
        style={{
          marginLeft: `${marginLeft}px`,
        }}
      >
        <span
          className="mr-2 text-[12px] text-zinc-500 dark:text-zinc-500"
        >
          └
        </span>
        {props.child.name}
      </div>
      {childItems}
    </>
  );
});

// TreeItem Component - Otimizado com memoização
export const TreeItem = memo(
  forwardRef<HTMLDivElement, Props>(function TreeItem(
    {
      childCount,
      clone,
      depth,
      disableSelection,
      disableInteraction,
      ghost,
      handleProps,
      indentationWidth,
      indicator,
      onEdit,
      onDelete,
      style,
      value,
      wrapperRef,
      ...props
    },
    ref,
  ) {
    const [open, setOpen] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    // Evita problemas de hidratação SSR
    const [isMounted, setIsMounted] = useState(false);
    React.useEffect(() => {
      setIsMounted(true);
    }, []);

    // Dados do item
    const itemData = props?.otherfields as unknown as {
      icon?: string;
      description?: string;
      name?: string;
      href?: string;
    };
    const itemName = itemData?.name || value || "Item sem nome";
    const itemHref = itemData?.href || "";
    const itemIcon = itemData?.icon;
    const itemDescription =
      itemData?.description || `URL: ${itemHref || "Não definida"}`;

    // Função para renderizar o ícone correto
    const renderItemIcon = useCallback(() => {
      if (itemIcon) {
        // Usa ícone específico - classe completa do Iconify/Lucide
        return (
          <span
            className={`${itemIcon} size-4 text-zinc-600 dark:text-zinc-400`}
            style={{ flexShrink: 0 }}
          />
        );
      }
      // Ícone SVG padrão
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: "#6b7280", flexShrink: 0 }}
        >
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
    }, [itemIcon]);

    // Memoização de estilos para evitar recálculos
    const wrapperStyle = useMemo(
      () => ({
        listStyle: "none" as const,
        boxSizing: "border-box" as const,
        marginBottom: "4px",
        WebkitFontSmoothing: "subpixel-antialiased" as const,
        ...(!clone
          ? {
              paddingLeft: `${indentationWidth * depth}px`,
            }
          : {
              display: "inline-block" as const,
              pointerEvents: "none" as const,
              padding: 0,
              paddingLeft: "10px",
              paddingTop: "5px",
            }),
      }),
      [clone, indentationWidth, depth],
    );

    const treeItemStyle = useMemo(
      () => ({
        ...style,
        minHeight:
          ghost && indicator && childCount
            ? `${childCount * 46 + (childCount - 1) * 4}px`
            : "44px",
      }),
      [style, ghost, indicator, childCount],
    );

    // Callbacks otimizados
    const handleToggleOpen = useCallback(() => setOpen(!open), [open]);
    const handleEdit = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (onEdit) {
          onEdit(value, itemData);
        }
      },
      [onEdit, value, itemData],
    );
    const handleDelete = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (onDelete) {
          onDelete(value, itemData);
        }
      },
      [onDelete, value, itemData],
    );

    // Renderização otimizada para SSR
    if (!isMounted) {
      return (
        <li
          className={classNames({
            Wrapper: true,
            clone: clone,
            ghost: ghost,
            indicator: indicator,
            disableSelection: disableSelection,
            disableInteraction: disableInteraction,
          })}
          ref={wrapperRef}
          style={wrapperStyle}
        >
          <div
            {...handleProps}
            className={`TreeItem flex items-center gap-2 p-3 w-full max-w-[414px] rounded-lg box-border cursor-grab select-none transition-all duration-200 border ${
              ghost && indicator
                ? "bg-transparent border-dashed border-2 border-zinc-300 dark:border-zinc-600 opacity-60"
                : "bg-white dark:bg-zinc-900 border-solid border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100"
            } ${clone ? "shadow-md pr-6" : ""}`}
            ref={ref}
            style={treeItemStyle}
          >
            {/* Grip Icon */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-zinc-400 dark:text-zinc-500 cursor-grab shrink-0"
            >
              <circle cx="9" cy="12" r="1" />
              <circle cx="9" cy="5" r="1" />
              <circle cx="9" cy="19" r="1" />
              <circle cx="15" cy="12" r="1" />
              <circle cx="15" cy="5" r="1" />
              <circle cx="15" cy="19" r="1" />
            </svg>

            {/* Item Icon */}
            {renderItemIcon()}

            {/* Item Name */}
            <span
              className="flex-1 font-medium text-[14px] text-zinc-700 dark:text-zinc-200 whitespace-nowrap text-ellipsis overflow-hidden"
            >
              {clone ? `📋 Movendo: ${itemName}` : itemName}
              {clone && childCount && childCount > 1 && (
                <span
                  className="text-[12px] font-normal text-zinc-500 dark:text-zinc-400 ml-1"
                >
                  ({childCount - 1} filhos)
                </span>
              )}
            </span>

            {/* Level Badge */}
            {!clone && (
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "32px",
                  height: "32px",
                  backgroundColor: "#f3f4f6",
                  borderRadius: "50%",
                  fontSize: "12px",
                  fontWeight: "500",
                  color: "#6b7280",
                  flexShrink: 0,
                }}
              >
                L{depth + 1}
              </span>
            )}

            {/* Action Buttons */}
            {!clone && !(ghost && indicator) && (
              <>
                <button
                  onClick={handleEdit}
                  className="flex items-center justify-center size-8 bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-700 border-none rounded-full cursor-pointer transition-colors"
                  title="Editar"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-zinc-500 dark:text-zinc-400"
                  >
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button
                  onClick={handleDelete}
                  className="flex items-center justify-center size-8 bg-transparent hover:bg-red-50 dark:hover:bg-red-900/30 border-none rounded-full cursor-pointer transition-colors"
                  title="Excluir"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-red-500 dark:text-red-400"
                  >
                    <path d="m3 6 3 0" />
                    <path d="m19 6-3 0" />
                    <path d="m8 6 0-2a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <path d="m4 6h16l-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6Z" />
                    <line x1="10" x2="10" y1="11" y2="17" />
                    <line x1="14" x2="14" y1="11" y2="17" />
                  </svg>
                </button>
                <Collapse open={open} handleOpen={handleToggleOpen} />
              </>
            )}

            {/* Children Preview for Clone */}
            {clone && childCount && childCount > 1 && props.childs ? (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  display: "flex",
                  flexDirection: "column",
                  zIndex: 1000,
                }}
              >
                {props.childs.map((child: TreeItemType) => (
                  <RecursiveItem
                    key={child.id as string}
                    child={child}
                    nDepth={1}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </li>
      );
    }

    return (
      <li
        className={classNames({
          Wrapper: true,
          clone: clone,
          ghost: ghost,
          indicator: indicator,
          disableSelection: disableSelection,
          disableInteraction: disableInteraction,
        })}
        ref={wrapperRef}
        style={wrapperStyle}
      >
        <div
          className={`TreeItem flex items-center gap-2 p-3 w-full max-w-[414px] rounded-lg box-border cursor-grab select-none transition-all duration-200 border ${
            ghost && indicator
              ? "bg-transparent border-dashed border-2 border-zinc-300 dark:border-zinc-600 opacity-60"
              : "bg-white dark:bg-zinc-900 border-solid border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100"
          } ${clone ? "shadow-md pr-6 bg-white dark:bg-zinc-900" : ""} ${
            !clone && !ghost && isHovered ? "bg-zinc-50 dark:bg-zinc-800" : ""
          }`}
          ref={ref}
          style={treeItemStyle}
          onMouseEnter={() => {
            if (!clone && !ghost) {
              setIsHovered(true);
            }
          }}
          onMouseLeave={() => {
            if (!clone && !ghost) {
              setIsHovered(false);
            }
          }}
        >
          {/* Área de Drag - Grip + Conteúdo */}
          <div
            {...handleProps}
            className="flex items-center gap-2 flex-1 cursor-grab min-w-0"
          >
            {/* Grip Icon */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: "#9ca3af", cursor: "grab", flexShrink: 0 }}
            >
              <circle cx="9" cy="12" r="1" />
              <circle cx="9" cy="5" r="1" />
              <circle cx="9" cy="19" r="1" />
              <circle cx="15" cy="12" r="1" />
              <circle cx="15" cy="5" r="1" />
              <circle cx="15" cy="19" r="1" />
            </svg>

            {/* Item Icon */}
            {renderItemIcon()}

            {/* Item Name */}
            <span
              className="flex-1 font-medium text-[14px] text-zinc-700 dark:text-zinc-200 whitespace-nowrap text-ellipsis overflow-hidden"
            >
              {clone ? `📋 Movendo: ${itemName}` : itemName}
              {clone && childCount && childCount > 1 && (
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: "400",
                    color: "#6b7280",
                    marginLeft: "4px",
                  }}
                >
                  ({childCount - 1} filhos)
                </span>
              )}
            </span>
          </div>

          {/* Área de Ações - Isolada do Drag */}
          <div
            className="flex items-center gap-1 shrink-0"
            onMouseDown={(e) => {
              // Previne que o drag seja iniciado quando clicar nos botões
              e.stopPropagation();
            }}
            onPointerDown={(e) => {
              // Previne que o drag seja iniciado quando clicar nos botões
              e.stopPropagation();
            }}
          >
            {/* Level Badge */}
            {!clone && (
              <span
                className="flex items-center justify-center size-8 bg-zinc-100 dark:bg-zinc-800 rounded-full text-[12px] font-medium text-zinc-500 dark:text-zinc-400 shrink-0"
              >
                L{depth + 1}
              </span>
            )}

            {/* Action Buttons - Só aparecem no hover */}
            {!clone && !(ghost && indicator) && isHovered && (
              <>
                <button
                  onClick={handleEdit}
                  onMouseDown={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="flex items-center justify-center size-8 bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-700 border-none rounded-full cursor-pointer transition-colors"
                  title="Editar"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-zinc-500 dark:text-zinc-400"
                  >
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button
                  onClick={handleDelete}
                  onMouseDown={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="flex items-center justify-center size-8 bg-transparent hover:bg-red-50 dark:hover:bg-red-900/30 border-none rounded-full cursor-pointer transition-colors"
                  title="Excluir"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-red-500 dark:text-red-400"
                  >
                    <path d="m3 6 3 0" />
                    <path d="m19 6-3 0" />
                    <path d="m8 6 0-2a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <path d="m4 6h16l-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6Z" />
                    <line x1="10" x2="10" y1="11" y2="17" />
                    <line x1="14" x2="14" y1="11" y2="17" />
                  </svg>
                </button>
              </>
            )}

            {/* Botão de Expandir/Recolher - sempre visível */}
            {!clone && !(ghost && indicator) && (
              <Collapse open={open} handleOpen={handleToggleOpen} />
            )}
          </div>

          {/* Children Preview for Clone */}
          {clone && childCount && childCount > 1 && props.childs ? (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                display: "flex",
                flexDirection: "column",
                zIndex: 1000,
              }}
            >
              {props.childs.map((child: TreeItemType) => (
                <RecursiveItem
                  key={child.id as string}
                  child={child}
                  nDepth={1}
                />
              ))}
            </div>
          ) : null}
        </div>

        {/* Dropdown Content - Informações do Item */}
        {!(props.show === "true") && open && (
          <div
            className="w-full max-w-[414px] border border-t-0 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-b-lg shadow-sm -mt-px"
          >
            <div
              className="p-4 flex flex-col gap-3"
            >
              {/* Header com ícone e nome */}
              <div
                className="flex items-center gap-2"
              >
                {renderItemIcon()}
                <h4
                  className="m-0 text-[16px] font-semibold text-zinc-900 dark:text-zinc-100"
                >
                  {itemName}
                </h4>
              </div>

              {/* Descrição */}
              <div>
                <p
                  className="m-0 text-[14px] text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-4"
                >
                  {itemDescription}
                </p>
              </div>

              {/* Informações adicionais */}
              <div
                className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-700"
              >
                <span className="text-[12px] text-zinc-400 dark:text-zinc-500">
                  Nível {depth + 1}
                </span>
                <span className="text-[12px] text-zinc-400 dark:text-zinc-500">
                  ID: {value}
                </span>
              </div>
            </div>
          </div>
        )}
      </li>
    );
  }),
);

// SortableTreeItem Props
interface SortableProps extends Props {
  id: UniqueIdentifier;
  childs?: TreeItems;
  show?: string;
  updateitem?: (
    id: UniqueIdentifier,
    data: Omit<TreeItemType, "children">,
  ) => void;
  otherfields?: Record<string, unknown>;
  onEdit?: (id: string, data: MenuItemData) => void;
  onDelete?: (id: string, data: MenuItemData) => void;
}

// Animation Layout Changes - Otimizado
const animateLayoutChanges: AnimateLayoutChanges = ({
  isSorting,
  wasDragging,
}) => (isSorting || wasDragging ? false : true);

// SortableTreeItem Component - Memoizado para performance
export const SortableTreeItem = memo(function SortableTreeItem({
  id,
  depth,
  ...props
}: SortableProps) {
  const {
    attributes,
    isDragging,
    isSorting,
    listeners,
    setDraggableNodeRef,
    setDroppableNodeRef,
    transform,
    transition,
  } = useSortable({
    id,
    animateLayoutChanges,
  });

  const style: CSSProperties = useMemo(
    () => ({
      transform: CSS.Translate.toString(transform),
      transition,
    }),
    [transform, transition],
  );

  return (
    <TreeItem
      ref={setDraggableNodeRef}
      wrapperRef={setDroppableNodeRef}
      style={style}
      depth={depth}
      ghost={isDragging}
      disableSelection={
        typeof navigator !== "undefined" &&
        /iPad|iPhone|iPod/.test(navigator.platform)
      }
      disableInteraction={isSorting}
      handleProps={{
        ...attributes,
        ...listeners,
      }}
      {...props}
    />
  );
});
