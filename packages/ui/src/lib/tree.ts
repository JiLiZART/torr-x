export interface TreeFile {
  index: number;
  path: string;
  size: number;
  progress?: number;
}

export interface TreeNode<F extends TreeFile> {
  name: string;
  path: string;
  size: number;
  /** Bytes done (size × progress), summed. */
  done: number;
  indices: number[];
  children: TreeNode<F>[];
  file?: F;
}

/** Groups files into folders by their path segments, keeping torrent order. */
export function buildTree<F extends TreeFile>(files: F[]): TreeNode<F>[] {
  const root: TreeNode<F> = { name: "", path: "", size: 0, done: 0, indices: [], children: [] };
  for (const f of files) {
    const parts = f.path.split(/[\\/]/).filter(Boolean);
    let node = root;
    const visit = (n: TreeNode<F>) => {
      n.size += f.size;
      n.done += f.size * (f.progress ?? 0);
      n.indices.push(f.index);
    };
    visit(root);
    parts.forEach((name, i) => {
      const path = parts.slice(0, i + 1).join("/");
      let child = node.children.find((c) => c.path === path && !c.file);
      if (i === parts.length - 1) {
        child = { name, path, size: 0, done: 0, indices: [], children: [], file: f };
        node.children.push(child);
      } else if (!child) {
        child = { name, path, size: 0, done: 0, indices: [], children: [] };
        node.children.push(child);
      }
      visit(child);
      node = child;
    });
  }
  return root.children;
}

export function folderPaths<F extends TreeFile>(nodes: TreeNode<F>[]): string[] {
  return nodes.flatMap((n) => (n.file ? [] : [n.path, ...folderPaths(n.children)]));
}
