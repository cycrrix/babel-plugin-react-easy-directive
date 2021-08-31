module.exports = function ({ types: t }) {
  return {
    visitor: {
      CallExpression(path) {
        // 被调用函数为成员表达式，并且为React.creatElement
        if (
          t.isMemberExpression(path.node.callee) &&
          t.isIdentifier(path.node.callee.object, { name: 'React' }) &&
          t.isIdentifier(path.node.callee.property, { name: 'createElement' })
        ) {
          // 获取第2个参数：props对象
          const props = path.node.arguments[1].properties;
          if (!props) {
            return;
          }
          let ifStatement;
          const pIf = props.find(p => p.key.value === '*if');
          if (pIf) {
            // 剔除*if属性，避免重复
            path.node.arguments[1].properties = props.filter(p => p !== pIf);
            ifStatement = t.ifStatement(pIf.value, t.returnStatement(path.node));
          }

          const pFor = props.find(p => p.key.value === '*for');
          // 剔除*for属性，避免重复
          path.node.arguments[1].properties = path.node.arguments[1].properties.filter(
            p => p !== pFor,
          );
          let forValue, forKey, forArray;
          if (pFor && t.isBinaryExpression(pFor.value, { operator: 'in' })) {
            const v_pFor = pFor.value;
            if (t.isIdentifier(v_pFor.right)) {
              forArray = v_pFor.right;
            }
            // 序列表达式:item,key
            if (t.isSequenceExpression(v_pFor.left)) {
              [forValue, forKey] = v_pFor.left.expressions;
            } else if (t.isIdentifier(v_pFor.left)) {
              forValue = v_pFor.left;
              forKey = t.identifier('index');
            }
            if (forArray && forValue && forKey) {
              let forItem;
              if (!path.node.arguments[1].properties.find(p => p.key.name === 'key')) {
                path.node.arguments[1].properties.push(
                  t.objectProperty(t.identifier('key'), forKey),
                );
              }
              forItem = ifStatement ? t.blockStatement([ifStatement]) : path.node;
              path.replaceWith(
                t.expressionStatement(
                  t.callExpression(t.memberExpression(forArray, t.identifier('map')), [
                    t.arrowFunctionExpression([forValue, forKey], forItem),
                  ]),
                ),
              );
            }
          } else if (ifStatement) {
            // CallExpression替换为if语句，内部会进行判断，将if语句转为CallExpression包裹，同时callee为FunctionExpression
            path.replaceWith(ifStatement);
          }
        }
      },
    },
  };
};
