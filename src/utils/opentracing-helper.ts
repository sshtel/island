import * as jaeger from 'jaeger-client';
import * as _ from 'lodash';
import * as opentracing from 'opentracing';

import { Environments } from '../utils/environments';
import { logger } from '../utils/logger';

export class OpentracingHelper {
  private tracer: opentracing.Tracer;

  constructor(serviceName: string) {
    const config = {
      serviceName,
      sampler: {
        type: 'const',
        param: 1
      }
    };
    const options = {
      tags: {},
      logger
    };
    const versionTag = serviceName + '.version';
    options.tags[versionTag] = Environments.getIslandVersion();
    this.tracer = jaeger.initTracer(config, options);
  }

  public startSpan(name: string, carrier: any): opentracing.Span {
    let span: opentracing.Span;
    if (carrier) {
      const ctx = this.tracer.extract(opentracing.FORMAT_TEXT_MAP, carrier);
      span = this.tracer.startSpan(name, { childOf: ctx as opentracing.SpanContext});
    } else {
      span = this.tracer.startSpan(name);
    }
    this.tracer.inject(span, opentracing.FORMAT_TEXT_MAP, carrier);
    return span;
  }

  public error(span: opentracing.Span, message: string, metaData?: any) {
    span.setTag(opentracing.Tags.ERROR, true);
    span.log({event: 'error', message, metaData});
    span.finish();
  }

}
